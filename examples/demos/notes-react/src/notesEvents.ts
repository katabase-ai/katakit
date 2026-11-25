import * as v from 'valibot';
import {
  reduceTranscriptEvent,
  type TranscriptRecordedEvent,
  type TranscriptState,
  type TranscriptTurn,
} from '@katakit/transcript-ingestion';
import { NoteSchema } from './notesModel';

const cursor = v.pipe(v.number(), v.integer(), v.minValue(0));
const transcriptItem = v.strictObject({
  id: v.pipe(v.string(), v.minLength(1)),
  sourceId: v.pipe(v.string(), v.minLength(1)),
  text: v.pipe(v.string(), v.regex(/\S/)),
  speaker: v.optional(v.string()),
  startMs: v.optional(v.pipe(v.number(), v.finite())),
  endMs: v.optional(v.pipe(v.number(), v.finite())),
}) satisfies v.GenericSchema<TranscriptTurn>;

/** Accepted outlines include their IDs and cursor, so replay needs neither a model nor new IDs. */
export const NotesEventSchema = v.variant('type', [
  v.strictObject({
    type: v.literal('transcriptTurn'),
    turn: transcriptItem,
  }),
  v.strictObject({ type: v.literal('transcriptSegment'), segment: transcriptItem }),
  v.strictObject({ type: v.literal('transcriptReset') }),
  v.strictObject({ type: v.literal('notesUpdated'), notes: v.array(NoteSchema), cursor }),
  v.strictObject({ type: v.literal('notesCleared'), cursor }),
]);

export type NotesEvent = v.InferOutput<typeof NotesEventSchema>;

export const notesTranscriptEvent = (event: NotesEvent): TranscriptRecordedEvent | undefined => {
  switch (event.type) {
    case 'transcriptSegment':
      return { type: 'segment', segment: event.segment };
    case 'transcriptTurn':
      return { type: 'turn', turn: event.turn };
    case 'transcriptReset':
      return { type: 'reset' };
    default:
      return undefined;
  }
};

/** Validate untrusted history before starting any runtime or acquiring live resources. */
export const parseNotesHistory = (history: unknown): NotesEvent[] => {
  const events = v.parse(v.array(NotesEventSchema), history);
  const turns = new Set<string>();
  const segments = new Set<string>();
  let transcript: TranscriptState = { segments: [], conversationTurns: [], currentTurn: undefined };
  let cursor = 0;
  for (const event of events) {
    const record = notesTranscriptEvent(event);
    if (record) {
      if (record.type === 'turn' && transcript.currentTurn) {
        const current = transcript.currentTurn;
        const fields = ['id', 'sourceId', 'text', 'speaker', 'startMs', 'endMs'] as const;
        if (fields.some(key => current[key] !== record.turn[key]))
          throw new Error('Transcript turn does not match its recorded segments');
      }
      const next = reduceTranscriptEvent(transcript, record);
      if (
        record.type === 'segment' &&
        next.conversationTurns.length !== transcript.conversationTurns.length
      )
        throw new Error('Notes history is missing a finalized transcript turn');
      transcript = next;
    }
    if (event.type === 'transcriptTurn') {
      const key = JSON.stringify([event.turn.sourceId, event.turn.id]);
      if (turns.has(key)) throw new Error('Duplicate transcript turn in notes history');
      turns.add(key);
    } else if (event.type === 'transcriptSegment') {
      const key = JSON.stringify([event.segment.sourceId, event.segment.id]);
      if (segments.has(key)) throw new Error('Duplicate transcript segment in notes history');
      segments.add(key);
    } else if (event.type === 'transcriptReset') {
      turns.clear();
      segments.clear();
      cursor = 0;
    } else {
      if (event.cursor < cursor || event.cursor > turns.size)
        throw new Error('Invalid processed-turn cursor in notes history');
      if (event.type === 'notesCleared' && event.cursor !== turns.size)
        throw new Error('A notes clear must consume all finalized turns');
      cursor = event.cursor;
      if (event.type === 'notesUpdated') {
        const ids = event.notes.flatMap(note => [note.id, ...note.children.map(child => child.id)]);
        if (ids.some(id => !id) || new Set(ids).size !== ids.length)
          throw new Error('Invalid note IDs in notes history');
      }
    }
  }
  return events;
};

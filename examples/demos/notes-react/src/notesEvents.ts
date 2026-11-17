import * as v from 'valibot';
import type { TranscriptTurn } from '@katakit/transcript-ingestion';
import { NoteSchema } from './notesModel';

const cursor = v.pipe(v.number(), v.integer(), v.minValue(0));

/** Accepted outlines include their IDs and cursor, so replay needs neither a model nor new IDs. */
export const NotesEventSchema = v.variant('type', [
  v.strictObject({
    type: v.literal('transcriptTurn'),
    turn: v.object({
      id: v.string(),
      sourceId: v.string(),
      text: v.string(),
      speaker: v.optional(v.string()),
      startMs: v.optional(v.number()),
      endMs: v.optional(v.number()),
    }) satisfies v.GenericSchema<TranscriptTurn>,
  }),
  v.strictObject({ type: v.literal('notesUpdated'), notes: v.array(NoteSchema), cursor }),
  v.strictObject({ type: v.literal('notesCleared'), cursor }),
]);

export type NotesEvent = v.InferOutput<typeof NotesEventSchema>;

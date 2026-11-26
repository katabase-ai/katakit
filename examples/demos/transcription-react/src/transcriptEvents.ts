import type { TranscriptIngestionEvent } from '@katakit/transcript-ingestion';
import * as v from 'valibot';

const text = v.pipe(v.string(), v.nonEmpty());
const time = v.pipe(v.number(), v.finite(), v.minValue(0));

/** Source IDs scope segment IDs across recordings, even when a recognizer starts counting again. */
export const SegmentSchema = v.object({
  sourceId: v.pipe(v.string(), v.nonEmpty()),
  id: v.pipe(v.string(), v.nonEmpty()),
  text: v.string(),
  startMs: v.optional(time),
  endMs: v.optional(time),
});

const eventSchema = v.variant('type', [
  v.strictObject({
    type: v.literal('utteranceAdded'),
    id: v.pipe(v.string(), v.nonEmpty()),
    speaker: v.pipe(v.string(), v.nonEmpty()),
    text,
    startMs: time,
    endMs: time,
  }),
  v.strictObject({
    type: v.literal('conversationTurnAdded'),
    id: v.pipe(v.string(), v.nonEmpty()),
    text,
    startMs: time,
    endMs: time,
  }),
  v.strictObject({
    type: v.literal('provisionalUtteranceAdded'),
    speaker: v.string(),
    text: v.string(),
  }),
]);

const recordedSchema = v.looseObject({
  meta: v.object({
    seq: v.pipe(v.number(), v.integer(), v.minValue(0)),
    timestamp: v.pipe(v.union([v.date(), v.pipe(v.string(), v.isoTimestamp())]), v.toDate()),
  }),
});

/** Read this demo's complete log, including JSON timestamps; never invent missing metadata. */
export const readTranscriptHistory = (records: readonly unknown[]): TranscriptIngestionEvent[] => {
  const utteranceIds = new Set<string>();
  const turnIds = new Set<string>();
  return records.map((record, index) => {
    const { meta, ...payload } = v.parse(recordedSchema, record);
    if (meta.seq !== index)
      throw new Error('Transcript history must have contiguous sequence numbers.');
    const event = v.parse(eventSchema, payload);
    if ('startMs' in event && event.endMs < event.startMs)
      throw new Error('Transcript audio timestamps must be ordered.');
    if (event.type !== 'provisionalUtteranceAdded') {
      const ids = event.type === 'utteranceAdded' ? utteranceIds : turnIds;
      if (ids.has(event.id)) throw new Error('Transcript history contains a duplicate ID.');
      ids.add(event.id);
    }
    return { ...event, meta: { ...meta, timestamp: new Date(meta.timestamp) } };
  });
};

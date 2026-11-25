import type { TranscriptSegment } from '@katakit/transcript-ingestion';

/** Storage is untrusted; never coerce IDs or timestamps during restoration. */
export const isSegment = (value: unknown): value is TranscriptSegment => {
  if (!value || typeof value !== 'object') return false;
  const segment = value as Record<string, unknown>;
  return (
    typeof segment.id === 'string' &&
    segment.id.length > 0 &&
    typeof segment.sourceId === 'string' &&
    segment.sourceId.length > 0 &&
    typeof segment.text === 'string' &&
    segment.text.trim().length > 0 &&
    (segment.speaker === undefined || typeof segment.speaker === 'string') &&
    [segment.startMs, segment.endMs].every(
      time => time === undefined || (typeof time === 'number' && Number.isFinite(time) && time >= 0)
    ) &&
    (segment.startMs === undefined ||
      segment.endMs === undefined ||
      (segment.startMs as number) <= (segment.endMs as number))
  );
};

/** First delivery wins; retain the same bounded, ordered window as the background host. */
export const restoreSegments = (value: unknown): TranscriptSegment[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter((segment): segment is TranscriptSegment => {
      if (!isSegment(segment)) return false;
      const key = JSON.stringify([segment.sourceId, segment.id]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-2000);
};

export type TranscriptMessage =
  | { type: 'CAPTURE_RESET' }
  | { type: 'TRANSCRIPT_SEGMENT'; segment: TranscriptSegment };

/** A reset received during asynchronous reads invalidates the entire old snapshot. */
export const orderHydration = (snapshot: unknown, queued: TranscriptMessage[]) => {
  const reset = queued.findLastIndex(message => message.type === 'CAPTURE_RESET');
  return {
    initialSegments: reset < 0 ? restoreSegments(snapshot) : [],
    live: queued.slice(reset + 1),
  };
};

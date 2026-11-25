import { parseTranscriptRecordedEvent } from '@katakit/transcript-ingestion';
import { parseBingoEvent } from './bingo';
import type { BrowserBingoEvent } from './createBrowserBingoDemo';
import type { KatakitEvent } from '@katakit/core';

/** Core trusts supplied events: the host validates both commands and restored history. */
export const parseBrowserBingoEvent = (input: unknown): BrowserBingoEvent => {
  if (!input || typeof input !== 'object' || !('type' in input) || !('event' in input))
    throw new Error('Invalid browser Bingo event.');
  if (input.type === 'bingo') return { type: 'bingo', event: parseBingoEvent(input.event) };
  if (input.type === 'transcript')
    return {
      type: 'transcript',
      event: structuredClone(parseTranscriptRecordedEvent(input.event)),
    };
  throw new Error('Unknown browser Bingo event.');
};

/** Import old metadata-free histories deterministically; retain core metadata on replay. */
export const restoreBrowserBingoHistory = (
  history: readonly unknown[]
): KatakitEvent<BrowserBingoEvent>[] =>
  history.map((input, index) => {
    const event = parseBrowserBingoEvent(input);
    const meta = (input as { meta?: unknown }).meta;
    if (meta === undefined) return { ...event, meta: { seq: index, timestamp: new Date(0) } };
    if (
      !meta ||
      typeof meta !== 'object' ||
      !('seq' in meta) ||
      meta.seq !== index ||
      !('timestamp' in meta)
    )
      throw new Error('Invalid Bingo history metadata.');
    const timestamp =
      meta.timestamp instanceof Date
        ? new Date(meta.timestamp)
        : typeof meta.timestamp === 'string'
          ? new Date(meta.timestamp)
          : new Date(NaN);
    if (!Number.isFinite(timestamp.getTime())) throw new Error('Invalid Bingo history timestamp.');
    return { ...event, meta: { seq: index, timestamp } };
  });

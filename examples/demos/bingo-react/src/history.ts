import { parseTranscriptRecordedEvent } from '@katakit/transcript-ingestion';
import { parseBingoEvent } from './bingo';
import type { BrowserBingoEvent } from './createBrowserBingoDemo';

/** The host validates initial history too: event-log deliberately trusts initialEvents. */
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

export const browserBingoEventSchema = {
  '~standard': {
    version: 1 as const,
    vendor: 'browser-bingo',
    validate: (input: unknown) => {
      try {
        return { value: parseBrowserBingoEvent(input) };
      } catch (error) {
        return { issues: [{ message: String(error) }] };
      }
    },
  },
};

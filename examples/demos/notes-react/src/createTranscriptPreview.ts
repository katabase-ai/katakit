import type { TranscriptEvent } from '@katakit/transcript-ingestion';
import { minBy } from 'es-toolkit';
import type { Observable } from 'rxjs';
import { match } from 'ts-pattern';

export type TranscriptPreviewWord = {
  id: number;
  text: string;
  durationMs: number;
  expiresAt: number;
  provisional: boolean;
};

/** Presentation time belongs to the live visit, not to the replayable transcript. */
export const createTranscriptPreview = ({
  events$,
  onWords,
}: {
  events$: Observable<TranscriptEvent>;
  onWords: (words: TranscriptPreviewWord[]) => void;
}) => {
  let finalized: TranscriptPreviewWord[] = [];
  let provisional: TranscriptPreviewWord[] = [];
  let showProvisional = false;
  let nextId = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const updateWords = ({ text, draft }: { text: string; draft: boolean }) => {
    const words = text.match(/\S+/g) ?? [];
    const now = Date.now();
    // Chunked recognizers deliver several words together. Stagger their fade within 20 seconds.
    const stagger = Math.min(180, 4000 / Math.max(1, words.length - 1));
    return words.map((text, index) => {
      const previous = provisional[index];
      const durationMs = 20_000 - (words.length - index - 1) * stagger;
      // Recognition corrections and finalization keep the original word's age and DOM identity.
      return previous
        ? { ...previous, text, provisional: draft }
        : { id: nextId++, text, durationMs, expiresAt: now + durationMs, provisional: draft };
    });
  };

  const publish = () => {
    if (timer) clearTimeout(timer);
    const now = Date.now();
    finalized = finalized.filter(word => word.expiresAt > now);
    // Keep expired draft slots until finalization so another provisional update cannot revive them.
    const visible = [...finalized, ...(showProvisional ? provisional : [])].filter(
      word => word.expiresAt > now
    );
    onWords(visible);
    const nextExpiry = minBy(visible, word => word.expiresAt);
    timer = nextExpiry ? setTimeout(publish, nextExpiry.expiresAt - now) : undefined;
  };

  const subscription = events$.subscribe(event => {
    if (event.type === 'turn') return;
    match(event)
      .with({ type: 'reset' }, () => {
        finalized = [];
        provisional = [];
        showProvisional = false;
      })
      .with({ type: 'provisional' }, ({ text }) => {
        showProvisional = !!text;
        // Ingestion clears provisional text immediately before publishing the finalized segment.
        if (text) provisional = updateWords({ text, draft: true });
        else {
          const cleared = provisional;
          queueMicrotask(() => {
            // A clear without a following segment discards the draft before the next utterance.
            if (provisional === cleared && !showProvisional) provisional = [];
          });
        }
      })
      .with({ type: 'segment' }, ({ segment }) => {
        finalized.push(...updateWords({ text: segment.text, draft: false }));
        provisional = [];
        showProvisional = false;
      })
      .exhaustive();
    publish();
  });

  return () => {
    subscription.unsubscribe();
    if (timer) clearTimeout(timer);
  };
};

import type { TranscriptEvent } from '@katakit/transcript-ingestion';
import type { Observable } from 'rxjs';

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

  const updateWords = (text: string, draft: boolean) => {
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
    timer = visible.length
      ? setTimeout(publish, Math.min(...visible.map(word => word.expiresAt)) - now)
      : undefined;
  };

  const subscription = events$.subscribe(event => {
    if (event.type === 'turn') return;
    if (event.type === 'reset') {
      finalized = [];
      provisional = [];
      showProvisional = false;
    } else if (event.type === 'provisional') {
      showProvisional = !!event.text;
      // Ingestion clears provisional text immediately before publishing the finalized segment.
      if (event.text) provisional = updateWords(event.text, true);
      else {
        const cleared = provisional;
        queueMicrotask(() => {
          // A clear without a following segment discards the draft before the next utterance.
          if (provisional === cleared && !showProvisional) provisional = [];
        });
      }
    } else {
      finalized.push(...updateWords(event.segment.text, false));
      provisional = [];
      showProvisional = false;
    }
    publish();
  });

  return () => {
    subscription.unsubscribe();
    if (timer) clearTimeout(timer);
  };
};

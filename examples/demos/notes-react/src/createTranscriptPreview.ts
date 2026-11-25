import type { Observable } from 'rxjs';

export type PreviewEvent = { type: 'provisional' | 'final'; text: string };

export type TranscriptPreviewLine = {
  id: number;
  text: string;
  expiresAt: number;
  provisional: boolean;
};

const lineLifetimeMs = 20_000;
// Lines normally leave by age; this only bounds a very fast speaker's column.
const maxLines = 30;

/**
 * One line per finalized segment, newest first, so an expiring line leaves from the end without
 * moving the others. Fast speech fills the column as far as it reaches. Presentation time belongs to the live visit, not the replayable transcript.
 * The structured-notes and bingo examples each carry this file so either can be copied alone.
 */
export const createTranscriptPreview = ({
  events$,
  onLines,
}: {
  events$: Observable<PreviewEvent>;
  onLines: (lines: TranscriptPreviewLine[]) => void;
}) => {
  let finalized: TranscriptPreviewLine[] = [];
  let draft: TranscriptPreviewLine | undefined;
  let showDraft = false;
  let nextId = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  // A draft keeps its identity through corrections and finalization; each update renews its time.
  const line = ({ text, provisional }: { text: string; provisional: boolean }) => ({
    id: draft?.id ?? nextId++,
    text,
    provisional,
    expiresAt: Date.now() + lineLifetimeMs,
  });

  const publish = () => {
    if (timer) clearTimeout(timer);
    const now = Date.now();
    finalized = finalized.filter(current => current.expiresAt > now).slice(0, maxLines);
    const visible = [...(showDraft && draft ? [draft] : []), ...finalized]
      .filter(current => current.expiresAt > now)
      .slice(0, maxLines);
    onLines(visible);
    timer = visible.length
      ? setTimeout(publish, Math.min(...visible.map(current => current.expiresAt)) - now)
      : undefined;
  };

  const subscription = events$.subscribe(event => {
    if (event.type === 'provisional') {
      showDraft = !!event.text;
      // Ingestion clears provisional text immediately before publishing the finalized segment.
      if (event.text) draft = line({ text: event.text, provisional: true });
      else {
        const cleared = draft;
        queueMicrotask(() => {
          // A clear without a following segment discards the draft before the next utterance.
          if (draft === cleared && !showDraft) draft = undefined;
        });
      }
    } else {
      finalized.unshift(line({ text: event.text, provisional: false }));
      draft = undefined;
      showDraft = false;
    }
    publish();
  });

  return () => {
    subscription.unsubscribe();
    if (timer) clearTimeout(timer);
  };
};

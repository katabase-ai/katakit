import { useEffect, useState, type ReactNode } from 'react';
import type { TranscriptEvent } from '@katakit/transcript-ingestion';
import type { Observable } from 'rxjs';
import { createTranscriptPreview, type TranscriptPreviewLine } from './createTranscriptPreview';

/**
 * A thin column of what was just said, newest line first. Expiry removes only a line's
 * presentation, never the transcript a demo keeps. The structured-notes and bingo examples each
 * carry this file so either can be copied alone.
 */
export const TranscriptPreview = ({
  events$,
  children,
}: {
  events$: Observable<TranscriptEvent>;
  /** A short note about the transcript, shown beneath its lines. */
  children?: ReactNode;
}) => {
  const [lines, setLines] = useState<TranscriptPreviewLine[]>([]);
  useEffect(() => createTranscriptPreview({ events$, onLines: setLines }), [events$]);
  return (
    <aside className="transcript-preview" aria-label="Transcript">
      <h2>Transcript</h2>
      <div className="transcript-preview-lines" aria-live="polite">
        {lines.map(line => (
          <p key={line.id} data-provisional={line.provisional}>
            {line.text}
          </p>
        ))}
      </div>
      {children}
    </aside>
  );
};

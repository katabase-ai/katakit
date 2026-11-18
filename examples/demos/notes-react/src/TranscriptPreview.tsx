import { useEffect, useState } from 'react';
import type { createNotesDemo } from './createNotesDemo';
import { createTranscriptPreview, type TranscriptPreviewWord } from './createTranscriptPreview';

/** Each word fades in place; expiry removes only its presentation, never the inference history. */
export const TranscriptPreview = ({
  events$,
}: {
  events$: ReturnType<typeof createNotesDemo>['transcriptEvents$'];
}) => {
  const [words, setWords] = useState<TranscriptPreviewWord[]>([]);
  useEffect(() => createTranscriptPreview({ events$, onWords: setWords }), [events$]);
  return (
    <section className="structured-notes-transcript" aria-label="Transcript">
      <h2>What you’re saying</h2>
      <p className="structured-notes-transcript-words">
        {!words.length && (
          <span className="structured-notes-empty">Your latest words appear here.</span>
        )}
        {words.map(word => (
          <span
            key={word.id}
            className="structured-notes-word"
            data-provisional={word.provisional}
            style={{ animationDuration: `${word.durationMs}ms` }}
          >
            {word.text}{' '}
          </span>
        ))}
      </p>
      <p className="structured-notes-hint">Spell out a misheard name to correct the note.</p>
    </section>
  );
};

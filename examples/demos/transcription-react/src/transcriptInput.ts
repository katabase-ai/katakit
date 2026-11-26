import { EventLogPlugin, makeKatakit } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import type { TranscriptionSegment } from '@katakit/transcription';
import * as v from 'valibot';
import { readTranscriptHistory, SegmentSchema } from './transcriptEvents';

/** Own one visit's ingestion log and live timer, independently of capture and model selection. */
export const createTranscriptInput = (initialEvents: readonly unknown[] = []) => {
  const turnSilenceMs = 1400;
  const transcript = makeTranscriptIngestionPlugin({ turnSilenceMs });
  const kit = makeKatakit({
    existingEvents: readTranscriptHistory(initialEvents),
    plugins: [transcript.configure({})],
  }).start();
  const input = kit.getMethods(transcript);
  const views = kit.getObservables(transcript);
  const { events$ } = kit.getObservables(EventLogPlugin);
  // Admission caches are reconstructed from the log, never a second transcript authority.
  const utterances = views.collectedUtterances$.get();
  const seen = new Set(utterances.map(utterance => utterance.id));
  let closed = false;
  const flush = () => {
    if (closed) return;
    input.flush();
    if (views.provisionalUtterance$.get()?.text)
      input.updateProvisionalUtterance({ speaker: 'input', text: '' });
  };
  return {
    views,
    events$,
    ingestSegment: (raw: TranscriptionSegment) => {
      if (closed) return;
      const segment = v.parse(SegmentSchema, raw);
      const text = segment.text.trim();
      const id = JSON.stringify([segment.sourceId, segment.id]);
      if (!text || seen.has(id)) return;
      const startMs = segment.startMs ?? 0;
      const endMs = segment.endMs ?? startMs;
      if (endMs < startMs) throw new Error('Transcript audio timestamps must be ordered.');
      const previous = views.collectedUtterances$.get().at(-1);
      if (
        previous &&
        (previous.speaker !== segment.sourceId ||
          (segment.startMs !== undefined && segment.startMs - previous.endMs > turnSilenceMs))
      )
        input.flush();
      input.ingestUtterance({
        id,
        speaker: segment.sourceId,
        text,
        startMs,
        endMs,
      });
      seen.add(id);
    },
    updateProvisional: (text: string) => {
      if (!closed) input.updateProvisionalUtterance({ text, speaker: 'input' });
    },
    flush,
    close: () => {
      if (closed) return;
      closed = true;
      input.close();
    },
  };
};

import { EventLogPlugin, makeKatakit, type WithEager } from '@katakit/core';
import {
  makeTranscriptIngestionPlugin,
  type TranscriptIngestionEvent,
} from '@katakit/transcript-ingestion';
import type { TranscriptionSegment } from '@katakit/transcription';
import type { Observable } from 'rxjs';

/** Own one visit's ingestion log and live timer, independently of capture and model selection. */
export const createTranscriptInput = (initialEvents: readonly TranscriptIngestionEvent[] = []) => {
  const turnSilenceMs = 1400;
  const transcript = makeTranscriptIngestionPlugin({ turnSilenceMs });
  const kit = makeKatakit({
    existingEvents: initialEvents.map(event => ({
      ...event,
      meta: { ...event.meta, timestamp: new Date(event.meta.timestamp) },
    })),
    plugins: [transcript.configure({})],
  }).start();
  const input = kit.getMethods(transcript);
  const views = kit.getObservables(transcript);
  // This runtime registers only ingestion, whose events are declared as KatakitEvent types.
  const events$ = kit.getObservables(EventLogPlugin).events$ as WithEager<
    Observable<TranscriptIngestionEvent>
  >;
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
    ingestSegment: (segment: TranscriptionSegment) => {
      if (closed) return;
      if (!segment.sourceId || !segment.id)
        throw new Error('Transcript input requires source and segment IDs.');
      const text = segment.text.trim();
      const id = JSON.stringify([segment.sourceId, segment.id]);
      if (!text || seen.has(id)) return;
      const startMs = segment.startMs ?? 0;
      const endMs = segment.endMs ?? startMs;
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs < 0 || endMs < startMs)
        throw new Error('Transcript audio timestamps must be finite, nonnegative, and ordered.');
      const previous = views.collectedUtterances$.get().at(-1);
      const pending = views.pendingConversationTurn$.get();
      // A reset clock or missing timestamps must not produce an end before the turn's start.
      if (
        (pending && endMs < pending.startMs) ||
        (previous &&
          (previous.speaker !== segment.sourceId ||
            (segment.startMs !== undefined && segment.startMs - previous.endMs > turnSilenceMs)))
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

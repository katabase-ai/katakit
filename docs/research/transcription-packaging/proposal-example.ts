// Typechecked illustration against proposal-api.d.ts. Not executable provider code.
import {
  createTranscriber,
  type AudioSource,
  type RecognizerStart,
  type RunEnd,
  type SegmentUpdate,
} from '@katakit/transcription';
import { createMoonshineEngine } from '@katakit/transcription-moonshine/browser';
import { createWhisperEngine } from '@katakit/transcription-whisper/browser';

export const connectSource = async (
  source: AudioSource,
  run: RecognizerStart,
  ingest: { ingestSegment(update: SegmentUpdate): void; endRun(end: RunEnd): void },
  comparison: { record(update: SegmentUpdate): void } | undefined
) => {
  const primary = createTranscriber({
    engine: createMoonshineEngine({ model: 'small', assetsBaseUrl: '/speech/moonshine/' }),
    onUpdate: update => ingest.ingestSegment(update),
    onStop: end => ingest.endRun(end),
  });
  const diagnostic = comparison
    ? createTranscriber({
        engine: createWhisperEngine({ model: 'tiny', assetsBaseUrl: '/speech/whisper/' }),
        onUpdate: update => comparison.record(update),
      })
    : undefined;
  await primary.start(run);
  await diagnostic?.start({ ...run, runId: crypto.randomUUID(), modelId: 'whisper-tiny' });
  // Host establishes run.audioOriginMs and source clock before this call.
  // AudioSource isolates subscriber errors; adapters copy any retained samples.
  const subscription = source.subscribe(frame => primary.write(frame));
  const diagnosticSubscription = diagnostic && source.subscribe(frame => diagnostic.write(frame));
  await source.start();
  return async () => {
    await source.stop();
    subscription.unsubscribe();
    diagnosticSubscription?.unsubscribe();
    await Promise.all([primary.stop(), diagnostic?.stop()]);
    await Promise.all([primary.dispose(), diagnostic?.dispose()]);
    await source.dispose();
  };
};

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
  let started = false;
  let sourceStarted = false;
  let subscription: ReturnType<AudioSource['subscribe']> | undefined;
  let diagnosticSubscription: ReturnType<AudioSource['subscribe']> | undefined;
  const cleanup = async () => {
    const failures: unknown[] = [];
    const settle = async (tasks: (() => unknown)[]) => {
      for (const result of await Promise.allSettled(
        tasks.map(task => Promise.resolve().then(task))
      )) {
        if (result.status === 'rejected') failures.push(result.reason);
      }
    };
    // Flush capture while both subscribers are still attached, even if one stop fails.
    if (sourceStarted) await settle([() => source.stop()]);
    await settle([() => subscription?.unsubscribe(), () => diagnosticSubscription?.unsubscribe()]);
    if (started) await settle([() => primary.stop(), () => diagnostic?.stop()]);
    await settle([() => primary.dispose(), () => diagnostic?.dispose(), () => source.dispose()]);
    if (failures.length) throw new AggregateError(failures, 'Could not fully stop transcription');
  };
  try {
    started = true;
    await primary.start(run);
    await diagnostic?.start({ ...run, runId: crypto.randomUUID(), modelId: 'whisper-tiny' });
    // Host establishes run.audioOriginMs and source clock before this call.
    // AudioSource isolates subscriber errors; adapters copy any retained samples.
    subscription = source.subscribe(frame => primary.write(frame));
    diagnosticSubscription = diagnostic && source.subscribe(frame => diagnostic.write(frame));
    sourceStarted = true;
    await source.start();
    return cleanup;
  } catch (error) {
    try {
      await cleanup();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Transcription startup and cleanup failed', {
        cause: error,
      });
    }
    throw error;
  }
};

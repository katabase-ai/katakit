import { expect, it } from 'vitest';
import { createTranscriber, type EngineEvents } from '@katakit/transcription';
import { createTranscriptionDemo } from '../src/createTranscriptionDemo';

it('connects standalone speech callbacks to local transcript events and turns', async () => {
  const methods = createTranscriptionDemo();
  let sink!: EngineEvents;
  let sourceId = '';
  const input = createTranscriber({
    engine: async callbacks => {
      sink = callbacks;
      return {
        start: id => {
          sourceId = id;
        },
        write: () => sink.onProvisional('unfinished'),
        stop: () =>
          sink.onFinal({ sourceId, id: '1', text: 'Final words.', startMs: 0, endMs: 100 }),
        close: () => {},
      };
    },
    onFinal: methods.ingestSegment,
    onProvisional: methods.updateProvisional,
    onStop: methods.flush,
  });
  await input.start({ sourceId: 'plain-pcm' });
  input.write(new Float32Array(1600), 16_000);
  expect(methods.state$.value.provisional).toBe('unfinished');
  await input.stop();
  expect(methods.state$.value.completedTurns).toMatchObject([
    { startMs: 0, endMs: 100, text: 'Final words.' },
  ]);
  expect(methods.state$.value.provisional).toBeUndefined();
  await input.dispose();
  methods.close();
});

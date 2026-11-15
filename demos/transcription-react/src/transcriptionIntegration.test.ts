import { expect, it } from 'vitest';
import { createTranscriber, type EngineEvents } from '@katakit/transcription';
import { makeKatakit } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';

it('connects standalone speech callbacks to local transcript events and turns', async () => {
  const TranscriptIngestionPlugin = makeTranscriptIngestionPlugin();
  const kit = makeKatakit({ plugins: [TranscriptIngestionPlugin.configure({})] });
  const methods = kit.start().getMethods(TranscriptIngestionPlugin);
  const { conversationTurns$, provisional$, events$ } =
    kit.getObservables(TranscriptIngestionPlugin);
  const events: string[] = [];
  const subscription = events$.subscribe(event => events.push(event.type));
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
  expect(provisional$.get()).toBe('unfinished');
  await input.stop();
  expect(conversationTurns$.get()).toMatchObject([{ sourceId: 'plain-pcm', text: 'Final words.' }]);
  expect(events).toContain('segment');
  expect(events).toContain('turn');
  await input.dispose();
  subscription.unsubscribe();
  methods.close();
});

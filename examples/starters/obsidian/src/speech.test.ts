import { afterEach, expect, it, vi } from 'vitest';
import { createShortClipTranscriber } from './speech';

vi.mock('@xenova/transformers', () => ({
  env: { backends: { onnx: { wasm: {} } } },
  AutoModelForSpeechSeq2Seq: { from_pretrained: async () => ({}) },
  AutoTokenizer: { from_pretrained: async () => ({}) },
  AutoProcessor: { from_pretrained: async () => ({}) },
  AutomaticSpeechRecognitionPipeline: class {
    async dispose() {}
  },
}));

afterEach(() => vi.unstubAllGlobals());

it('releases tracks and allows retry after an asynchronous recorder error', async () => {
  const stopTrack = vi.fn();
  const status = vi.fn();
  const error = vi.fn();
  class FakeRecorder extends EventTarget {
    static last: FakeRecorder;
    state = 'inactive';
    mimeType = 'audio/webm';
    constructor() {
      super();
      FakeRecorder.last = this;
    }
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      this.dispatchEvent(new Event('stop'));
    }
  }
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: stopTrack }] }) },
  });

  const speech = createShortClipTranscriber({ status, final: vi.fn(), error });
  await speech.start();
  FakeRecorder.last.dispatchEvent(new Event('error'));
  expect(error).toHaveBeenCalledOnce();
  expect(stopTrack).toHaveBeenCalledOnce();
  await expect(speech.start()).resolves.toBeUndefined();
  expect(FakeRecorder.last.state).toBe('recording');
  await speech.dispose();
  expect(stopTrack).toHaveBeenCalledTimes(2);
});

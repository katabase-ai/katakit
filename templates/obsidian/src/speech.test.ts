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

it('releases tracks and rejects Stop after an asynchronous recorder error', async () => {
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
  await expect(speech.stop()).rejects.toThrow('Audio recording failed.');
  expect(error).toHaveBeenCalledOnce();
  expect(stopTrack).toHaveBeenCalledOnce();
  await speech.dispose();
});

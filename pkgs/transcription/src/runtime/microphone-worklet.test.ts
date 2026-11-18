import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const postMessage = vi.fn();
const registerProcessor = vi.fn();

beforeEach(() => {
  vi.resetModules();
  postMessage.mockClear();
  registerProcessor.mockClear();
  vi.stubGlobal(
    'AudioWorkletProcessor',
    class {
      port = { onmessage: null, postMessage };
    }
  );
  vi.stubGlobal('registerProcessor', registerProcessor);
});
afterEach(() => vi.unstubAllGlobals());

test('registers a prototype process method and flushes partial microphone audio', async () => {
  await import('./microphone-worklet');
  const [name, Processor] = registerProcessor.mock.calls[0]!;
  expect(name).toBe('transcription-microphone-capture');
  expect(typeof Processor.prototype.process).toBe('function');

  const processor = new Processor();
  expect(processor.process([[new Float32Array([0.25, -0.5])]])).toBe(true);
  processor.port.onmessage();
  expect(postMessage.mock.calls[0]?.[0]).toMatchObject({
    type: 'audio',
    samples: new Float32Array([0.25, -0.5]),
  });
  expect(postMessage.mock.calls[1]?.[0]).toEqual({ type: 'flushed' });
});

import { afterEach, expect, test, vi } from 'vitest';
import { createMicrophoneCapture } from './microphoneCapture';

afterEach(() => vi.unstubAllGlobals());

test('cancels pending permission and stops a late grant without constructing an audio graph', async () => {
  const permission = Promise.withResolvers<MediaStream>();
  const stop = vi.fn();
  const audioContext = vi.fn();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => permission.promise } });
  vi.stubGlobal('AudioContext', audioContext);
  const lifetime = new AbortController();
  const onError = vi.fn();
  const capture = createMicrophoneCapture('/worklet.js', vi.fn(), onError);
  const starting = capture.start(lifetime.signal);
  const cancelled = (async () => {
    await expect(starting).rejects.toMatchObject({ name: 'AbortError' });
  })();
  lifetime.abort();
  await cancelled;
  await capture.stop();
  permission.resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  await Promise.resolve();
  expect(stop).toHaveBeenCalledOnce();
  expect(audioContext).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
});

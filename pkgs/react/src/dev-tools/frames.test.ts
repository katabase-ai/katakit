import { afterEach, expect, test, vi } from 'vitest';
import { describeFrame, isInternalFrame, makeFrameResolver } from './frames';

afterEach(() => vi.unstubAllGlobals());

test('shows the enclosing name for Firefox anonymous frames without changing their location', () => {
  const location = 'https://app.example/src/microphone.ts:42:7';
  expect(describeFrame(`useMicrophoneTranscriber/<@${location}`)).toEqual({
    name: 'useMicrophoneTranscriber',
    file: 'microphone.ts:42',
    path: location,
  });
  expect(describeFrame(`build/</<@${location}`).name).toBe('build');
  expect(describeFrame(`<@${location}`).name).toBe('Anonymous function');
  expect(describeFrame(`at Object.next (${location})`).name).toBe('Object.next');
});

test('maps a generated delivery frame before filtering, and shares the lookup between inspections', async () => {
  const origin = 'https://app.example';
  vi.stubGlobal('window', { location: { origin } });
  const fetchFile = vi.fn(async (url: string | URL) =>
    String(url).endsWith('.map')
      ? Response.json({
          version: 3,
          names: [],
          sources: ['../node_modules/rxjs/src/Subject.ts'],
          mappings: 'AAAA',
        })
      : new Response('/* bundled code */\n//# sourceMappingURL=bundle.js.map')
  );
  vi.stubGlobal('fetch', fetchFile);
  const resolve = makeFrameResolver(new AbortController().signal);
  const frame = `at notify (${origin}/assets/bundle.js:1:1)`;
  const [a, b] = await Promise.all([resolve(frame), resolve(frame)]);
  expect(a).toBe(`at notify (${origin}/node_modules/rxjs/src/Subject.ts:1:1)`);
  expect(b).toBe(a);
  expect(isInternalFrame(a!)).toBe(true);
  expect(fetchFile).toHaveBeenCalledTimes(2);
  const external = `notify@https://elsewhere.example/bundle.js:1:1`;
  expect(await resolve(external)).toBe(external);
  expect(fetchFile).toHaveBeenCalledTimes(2);
});

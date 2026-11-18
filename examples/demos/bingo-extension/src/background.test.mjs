import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

describe('extension capture coordinator', () => {
  it.each([false, true])(
    'recovers an errored document (initial cleanup fails: %s) and resets the transcript',
    async cleanupFails => {
      let listener;
      let documentOpen = true;
      let closeAttempts = 0;
      const events = [];
      const chrome = {
        runtime: {
          onMessage: { addListener: callback => (listener = callback) },
          sendMessage: vi.fn(async message => {
            events.push(message.type);
            if (message.type === 'OFFSCREEN_START') return { ok: true };
          }),
        },
        storage: {
          session: {
            set: vi.fn(async () => {}),
            get: vi.fn(async () => ({ capture: { phase: 'error' } })),
          },
        },
        offscreen: {
          hasDocument: vi.fn(async () => documentOpen),
          closeDocument: vi.fn(async () => {
            if (cleanupFails && ++closeAttempts === 1) throw new Error('Temporarily unavailable');
            documentOpen = false;
          }),
          createDocument: vi.fn(async () => {
            documentOpen = true;
          }),
        },
        tabs: { query: vi.fn(async () => [{ id: 1, url: 'https://example.com' }]) },
        tabCapture: { getMediaStreamId: vi.fn(async () => 'stream-id') },
      };
      vi.stubGlobal('chrome', chrome);
      vi.resetModules();
      await import('../public/background.js');

      listener({ type: 'CAPTURE_STATUS', phase: 'error', error: 'Model failed' });
      const result = await new Promise(resolve => listener({ type: 'START_CAPTURE' }, {}, resolve));

      expect(result).toEqual({ ok: true });
      expect(chrome.offscreen.closeDocument).toHaveBeenCalledTimes(cleanupFails ? 2 : 1);
      expect(events).toEqual(['CAPTURE_RESET', 'OFFSCREEN_START']);
    }
  );
});

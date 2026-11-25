import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

describe('extension capture coordinator', () => {
  it('a stop during startup waits for the owner, then drains and closes it', async () => {
    vi.resetModules();
    let listener;
    let resolveStart;
    let started;
    const entered = new Promise(resolve => {
      started = resolve;
    });
    const pending = new Promise(resolve => {
      resolveStart = resolve;
    });
    let documentOpen = false;
    const events = [];
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: { addListener: callback => (listener = callback) },
        sendMessage: vi.fn(async message => {
          events.push(message.type);
          if (message.type === 'OFFSCREEN_START') {
            started();
            await pending;
          }
          return { ok: true };
        }),
      },
      storage: { session: { get: async () => ({}), set: async () => {} } },
      offscreen: {
        hasDocument: async () => documentOpen,
        createDocument: async () => {
          documentOpen = true;
        },
        closeDocument: async () => {
          events.push('closed');
          documentOpen = false;
        },
      },
      tabs: { query: async () => [{ id: 1, url: 'https://example.com' }] },
      tabCapture: { getMediaStreamId: async () => 'stream' },
    });
    await import('../public/background.js');
    const start = new Promise(resolve => listener({ type: 'START_CAPTURE' }, {}, resolve));
    await entered;
    const stop = new Promise(resolve => listener({ type: 'STOP_CAPTURE' }, {}, resolve));
    expect(events).not.toContain('OFFSCREEN_STOP');
    resolveStart();
    expect(await start).toEqual({ ok: true });
    expect(await stop).toEqual({ ok: true });
    expect(events).toEqual(['CAPTURE_RESET', 'OFFSCREEN_START', 'OFFSCREEN_STOP', 'closed']);
    expect(documentOpen).toBe(false);
  });

  it('serializes overlapping writes, deduplicates identities, validates and retains last 2000', async () => {
    vi.resetModules();
    let listener;
    let stored = {
      segments: Array.from({ length: 2000 }, (_, id) => ({
        id: String(id),
        sourceId: 's',
        text: 'old',
      })),
    };
    const chrome = {
      runtime: {
        onMessage: { addListener: callback => (listener = callback) },
        sendMessage: vi.fn(async () => ({ ok: true })),
      },
      storage: {
        session: {
          get: vi.fn(async () => structuredClone(stored)),
          set: vi.fn(async value => {
            stored = { ...stored, ...value };
          }),
        },
      },
      offscreen: { hasDocument: vi.fn(async () => true), closeDocument: vi.fn(async () => {}) },
    };
    vi.stubGlobal('chrome', chrome);
    await import('../public/background.js');
    const segment = { id: 'new', sourceId: 's', text: 'new' };
    listener({ type: 'TRANSCRIPT_SEGMENT', segment });
    listener({ type: 'TRANSCRIPT_SEGMENT', segment: { ...segment, text: 'duplicate' } });
    listener({ type: 'TRANSCRIPT_SEGMENT', segment: { ...segment, id: 'next' } });
    listener({ type: 'TRANSCRIPT_SEGMENT', segment: { ...segment, id: false } });
    const result = await new Promise(resolve => listener({ type: 'STOP_CAPTURE' }, {}, resolve));
    expect(result).toEqual({ ok: true });
    expect(stored.segments).toHaveLength(2000);
    expect(stored.segments[0].id).toBe('2');
    expect(stored.segments.slice(-2)).toEqual([segment, { ...segment, id: 'next' }]);
    expect(chrome.offscreen.closeDocument).toHaveBeenCalledOnce();
  });

  it('closes the offscreen document even when draining capture fails', async () => {
    vi.resetModules();
    let listener;
    const closeDocument = vi.fn(async () => {});
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: { addListener: callback => (listener = callback) },
        sendMessage: vi.fn(async () => ({ ok: false, error: 'Drain failed' })),
      },
      offscreen: { hasDocument: vi.fn(async () => true), closeDocument },
    });
    await import('../public/background.js');
    const result = await new Promise(resolve => listener({ type: 'STOP_CAPTURE' }, {}, resolve));
    expect(result).toEqual({ ok: false, error: 'Error: Drain failed' });
    expect(closeDocument).toHaveBeenCalledOnce();
  });

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
      expect(events).toEqual(['OFFSCREEN_STOP', 'CAPTURE_RESET', 'OFFSCREEN_START']);
    }
  );
});

import { beforeEach, expect, test, vi } from 'vitest';

let listener;
let documentOpen;
let segments;
let capture;
let chrome;

const send = message => new Promise(resolve => listener(message, {}, resolve));

beforeEach(async () => {
  vi.resetModules();
  documentOpen = false;
  segments = [];
  capture = undefined;
  chrome = {
    runtime: {
      onMessage: { addListener: callback => (listener = callback) },
      sendMessage: vi.fn(async message => {
        if (message.type === 'OFFSCREEN_START' || message.type === 'OFFSCREEN_STOP')
          return { ok: true };
      }),
    },
    storage: {
      session: {
        get: vi.fn(async () => ({ segments, capture })),
        set: vi.fn(async values => {
          if (values.segments) segments = values.segments;
          if (values.capture) capture = values.capture;
        }),
        remove: vi.fn(async () => {
          segments = [];
        }),
      },
    },
    offscreen: {
      hasDocument: vi.fn(async () => documentOpen),
      createDocument: vi.fn(async () => {
        documentOpen = true;
      }),
      closeDocument: vi.fn(async () => {
        documentOpen = false;
      }),
    },
    tabs: { query: vi.fn(async () => [{ id: 1, url: 'https://example.com' }]) },
    tabCapture: { getMediaStreamId: vi.fn(async () => 'tab-stream') },
  };
  vi.stubGlobal('chrome', chrome);
  await import('../public/background.js');
});

test('serializes segments, drains storage before Stop, and clears on request', async () => {
  expect(await send({ type: 'START_CAPTURE' })).toEqual({ ok: true });
  listener({ type: 'TRANSCRIPT_SEGMENT', segment: { id: '1', text: 'First' } });
  listener({ type: 'TRANSCRIPT_SEGMENT', segment: { id: '2', text: 'Second' } });
  expect(await send({ type: 'STOP_CAPTURE' })).toEqual({ ok: true });
  expect(segments.map(segment => segment.text)).toEqual(['First', 'Second']);
  expect(capture).toEqual({ phase: 'idle' });
  expect(documentOpen).toBe(false);
  expect(await send({ type: 'CLEAR_TRANSCRIPT' })).toEqual({ ok: true });
  expect(segments).toEqual([]);
});

test('replaces an errored document before another capture', async () => {
  documentOpen = true;
  capture = { phase: 'error' };
  expect(await send({ type: 'START_CAPTURE' })).toEqual({ ok: true });
  expect(chrome.offscreen.closeDocument).toHaveBeenCalledOnce();
  expect(chrome.offscreen.createDocument).toHaveBeenCalledOnce();
});

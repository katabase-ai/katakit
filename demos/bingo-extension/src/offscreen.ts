import { createCapture } from '../../../templates/chrome-extension/src/capture';
import { createWhisperChunks } from './whisperChunks';
import type { WhisperRequest, WhisperResponse } from './whisperProtocol';
// oxlint-disable-next-line import/default
import WhisperWorker from './whisperWorker?worker';

let capture: ReturnType<typeof createCapture> | undefined;
let worker: Worker | undefined;
let chunks = createWhisperChunks();
let queued: { id: number; audio: Float32Array }[] = [];
let nextId = 0;
let inFlight = false;
let sessionId = '';
let ready: ((value: void) => void) | undefined;
let drained: (() => void) | undefined;
let error: string | undefined;

const status = (phase: string, extra: object = {}) =>
  void chrome.runtime.sendMessage({ type: 'CAPTURE_STATUS', phase, ...extra });

const sendNext = () => {
  if (inFlight || !queued.length || !worker || error) return;
  const item = queued.shift()!;
  inFlight = true;
  worker.postMessage({ type: 'transcribe', ...item } satisfies WhisperRequest, [item.audio.buffer]);
};
const enqueue = (audio: Float32Array) => {
  queued.push({ id: nextId++, audio });
  sendNext();
};

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === 'OFFSCREEN_START') {
    (async () => {
      try {
        if (capture) throw new Error('Capture already running.');
        error = undefined;
        chunks = createWhisperChunks();
        queued = [];
        nextId = 0;
        sessionId = crypto.randomUUID();
        status('loading');
        worker = new WhisperWorker();
        worker.onerror = event => {
          error = event.message || 'Speech recognition failed.';
          ready?.();
          drained?.();
          status('error', { error });
          void capture?.stop();
        };
        worker.onmessage = ({ data }: MessageEvent<WhisperResponse>) => {
          if (data.type === 'progress') status('loading', { progress: data.progress });
          if (data.type === 'ready') ready?.();
          if (data.type === 'error') {
            error = data.message;
            ready?.();
            drained?.();
            status('error', { error });
            void capture?.stop();
          }
          if (data.type === 'transcript') {
            inFlight = false;
            if (data.text.trim())
              void chrome.runtime.sendMessage({
                type: 'TRANSCRIPT_SEGMENT',
                segment: { sourceId: sessionId, id: String(data.id), text: data.text },
              });
            sendNext();
            if (!inFlight && !queued.length) drained?.();
          }
        };
        await new Promise<void>(resolve => {
          ready = resolve;
          worker!.postMessage({
            type: 'warmup',
            wasmPath: chrome.runtime.getURL('ort/'),
          } satisfies WhisperRequest);
        });
        ready = undefined;
        if (error) throw new Error(error);
        capture = createCapture(samples => {
          for (const chunk of chunks.push(samples)) enqueue(chunk);
        });
        const { micConnected } = await capture.start(message.streamId);
        status('recording', { micConnected });
        respond({ ok: true });
      } catch (error_) {
        await capture?.stop();
        worker?.terminate();
        capture = undefined;
        worker = undefined;
        status('error', { error: String(error_) });
        respond({ ok: false, error: String(error_) });
      }
    })();
    return true;
  }
  if (message.type === 'OFFSCREEN_STOP') {
    (async () => {
      try {
        await capture?.stop();
        capture = undefined;
        const last = chunks.flush();
        if (last && !error) enqueue(last);
        if ((inFlight || queued.length) && !error)
          await new Promise<void>(resolve => {
            drained = resolve;
          });
        drained = undefined;
        status('idle');
        respond({ ok: true });
      } catch (error_) {
        respond({ ok: false, error: String(error_) });
      } finally {
        worker?.terminate();
        worker = undefined;
      }
    })();
    return true;
  }
});

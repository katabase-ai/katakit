import { createCapture } from '../../../templates/chrome-extension/src/capture';
import { defaultTranscriptionAssetsBaseUrl } from '@katakit/transcription/browser';
import { audioLevel, createAudioLevelReporter } from '@katakit/site-ui/audio-level';
import { createPcmChunks } from './pcmChunks';
import type { MoonshineRequest, MoonshineResponse } from './moonshineProtocol';
// oxlint-disable-next-line import/default
import MoonshineWorker from './moonshineWorker?worker';

let capture: ReturnType<typeof createCapture> | undefined;
let worker: Worker | undefined;
let chunks = createPcmChunks();
let sessionId = '';
let ready: (() => void) | undefined;
let stopped: (() => void) | undefined;
let error: string | undefined;
let modelReady = false;

const status = (phase: string, extra: object = {}) =>
  void chrome.runtime.sendMessage({ type: 'CAPTURE_STATUS', phase, ...extra });

const fail = (message: string) => {
  error = message;
  ready?.();
  stopped?.();
  status('error', { error });
  const active = capture;
  capture = undefined;
  void active?.stop();
  worker?.terminate();
  worker = undefined;
  modelReady = false;
};

const getWorker = () => {
  if (worker) return worker;
  worker = new MoonshineWorker();
  worker.onerror = event => fail(event.message || 'Speech recognition failed.');
  worker.onmessage = ({ data }: MessageEvent<MoonshineResponse>) => {
    if (data.type === 'progress') status('loading', { progress: data.progress });
    if (data.type === 'ready') ready?.();
    if (data.type === 'stopped') stopped?.();
    if (data.type === 'error') fail(data.message);
    if (data.type === 'final')
      void chrome.runtime.sendMessage({ type: 'TRANSCRIPT_SEGMENT', segment: data.segment });
  };
  return worker;
};

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === 'OFFSCREEN_START') {
    (async () => {
      try {
        if (capture) throw new Error('Capture already running.');
        error = undefined;
        chunks = createPcmChunks();
        sessionId = crypto.randomUUID();
        status('loading');
        const recognizer = getWorker();
        if (!modelReady) {
          await new Promise<void>(resolve => {
            ready = resolve;
            recognizer.postMessage({
              type: 'warmup',
              assetUrl: chrome.runtime.getURL(
                `${defaultTranscriptionAssetsBaseUrl.slice(1)}moonshine/index.js`
              ),
            } satisfies MoonshineRequest);
          });
          ready = undefined;
          if (error) throw new Error(error);
          modelReady = true;
        }
        recognizer.postMessage({ type: 'start', sourceId: sessionId } satisfies MoonshineRequest);
        const reportInputLevel = createAudioLevelReporter(level => {
          void chrome.runtime.sendMessage({ type: 'CAPTURE_LEVEL', source: 'tab', level });
        }, 16_000);
        capture = createCapture(
          samples => {
            reportInputLevel(samples);
            for (const chunk of chunks.push(samples))
              recognizer.postMessage({ type: 'audio', samples: chunk } satisfies MoonshineRequest, [
                chunk.buffer,
              ]);
          },
          samples =>
            void chrome.runtime.sendMessage({
              type: 'CAPTURE_LEVEL',
              source: 'mic',
              level: audioLevel(samples),
            })
        );
        const { micConnected } = await capture.start(message.streamId);
        if (error) throw new Error(error);
        status('recording', { micConnected });
        respond({ ok: true });
      } catch (error_) {
        await capture?.stop();
        capture = undefined;
        worker?.terminate();
        worker = undefined;
        modelReady = false;
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
        if (last && !error)
          worker?.postMessage({ type: 'audio', samples: last } satisfies MoonshineRequest, [
            last.buffer,
          ]);
        if (worker && !error)
          await new Promise<void>(resolve => {
            stopped = resolve;
            worker!.postMessage({ type: 'stop' } satisfies MoonshineRequest);
          });
        stopped = undefined;
        if (!error) status('idle');
        respond({ ok: true });
      } catch (error_) {
        respond({ ok: false, error: String(error_) });
      } finally {
        if (error) {
          worker?.terminate();
          worker = undefined;
          modelReady = false;
        }
      }
    })();
    return true;
  }
});

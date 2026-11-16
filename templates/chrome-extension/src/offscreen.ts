import {
  createBrowserTranscriber,
  defaultTranscriptionAssetsBaseUrl,
} from '@katakit/transcription/browser';
import type { Transcriber } from '@katakit/transcription';
import { createCapture } from './capture';

let capture: ReturnType<typeof createCapture> | undefined;
let recognizer: Transcriber | undefined;
let stopping: Promise<void> | undefined;
let failed = false;
let diagnostics = {
  tab: 0,
  mic: undefined as number | undefined,
  capturedSeconds: 0,
  forwardedSeconds: 0,
  provisional: 0,
  final: 0,
  ready: false,
};

const status = (phase: string, extra: object = {}) =>
  void chrome.runtime.sendMessage({ type: 'CAPTURE_STATUS', phase, ...extra });
const report = () =>
  void chrome.runtime.sendMessage({ type: 'CAPTURE_DIAGNOSTICS', ...diagnostics });

const stop = () => {
  stopping ??= (async () => {
    try {
      const active = capture;
      capture = undefined;
      try {
        await active?.stop(); // Deliver the last PCM buffer before draining recognition.
      } finally {
        try {
          await recognizer?.stop();
        } finally {
          report();
          await chrome.runtime.sendMessage({ type: 'TRANSCRIPT_STOP' });
          if (!failed) await chrome.runtime.sendMessage({ type: 'CAPTURE_STATUS', phase: 'idle' });
        }
      }
    } finally {
      stopping = undefined;
    }
  })();
  return stopping;
};

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type !== 'OFFSCREEN_START' && message.type !== 'OFFSCREEN_STOP') return;
  void (async () => {
    try {
      if (message.type === 'OFFSCREEN_STOP') {
        await stop();
      } else {
        if (capture || stopping) throw new Error('Capture already running.');
        failed = false;
        diagnostics = {
          tab: 0,
          mic: undefined,
          capturedSeconds: 0,
          forwardedSeconds: 0,
          provisional: 0,
          final: 0,
          ready: false,
        };
        report();
        status('loading');
        recognizer ??= createBrowserTranscriber({
          model: 'moonshine-tiny',
          assetsBaseUrl: chrome.runtime.getURL(defaultTranscriptionAssetsBaseUrl.slice(1)),
          onState: state => {
            if (state.phase === 'loading') status('loading', { progress: state.progress });
            if (state.phase === 'error') {
              failed = true;
              status('error', { error: state.error?.message ?? 'Recognition failed.' });
              void stop();
            }
          },
          onProvisional: () => {
            diagnostics.provisional++;
          },
          onFinal: segment => {
            diagnostics.final++;
            report();
            void chrome.runtime.sendMessage({ type: 'TRANSCRIPT_SEGMENT', segment });
          },
        });
        const current = recognizer;
        let ready = false;
        capture = createCapture(
          samples => {
            diagnostics.capturedSeconds += samples.length / 16_000;
            // Capture must redeem Chrome's short-lived stream ID before the
            // first model download. Discard audio until recognition is ready.
            if (!ready) return;
            try {
              current.write(samples, 16_000);
              diagnostics.forwardedSeconds += samples.length / 16_000;
            } catch (error) {
              failed = true;
              status('error', { error: String(error) });
              void stop();
            }
          },
          levels => {
            diagnostics.tab = levels.tab;
            diagnostics.mic = levels.mic;
            report();
          }
        );
        const { micConnected } = await capture.start(message.streamId);
        await current.start();
        ready = true;
        diagnostics.ready = true;
        report();
        if (failed) throw new Error('Recognition failed while starting capture.');
        status('recording', { micConnected });
      }
      respond({ ok: true });
    } catch (error) {
      failed = true;
      status('error', { error: error instanceof Error ? error.message : String(error) });
      try {
        await stop();
      } finally {
        const current = recognizer;
        recognizer = undefined;
        await current?.dispose();
      }
      respond({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();
  return true;
});

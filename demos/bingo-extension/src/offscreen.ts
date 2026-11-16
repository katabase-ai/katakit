import { createCapture } from './capture';
import {
  createBrowserTranscriber,
  defaultTranscriptionAssetsBaseUrl,
} from '@katakit/transcription/browser';
import type { Transcriber } from '@katakit/transcription';
import { audioLevel, createAudioLevelReporter } from './audioLevel';

let capture: ReturnType<typeof createCapture> | undefined;
let recognizer: Transcriber | undefined;
let starting: Promise<void> | undefined;
let stopping: Promise<void> | undefined;
let error: string | undefined;

const status = (phase: string, extra: object = {}) =>
  void chrome.runtime.sendMessage({ type: 'CAPTURE_STATUS', phase, ...extra });
const fail = (error_: unknown) => {
  if (error) return;
  error = error_ instanceof Error ? error_.message : String(error_);
  status('error', { error });
  void (async () => {
    try {
      await stopSession();
    } catch {
      /* The error was reported through CAPTURE_STATUS. */
    }
  })();
};
const getRecognizer = () => {
  recognizer ??= createBrowserTranscriber({
    model: 'moonshine-tiny',
    assetsBaseUrl: chrome.runtime.getURL(defaultTranscriptionAssetsBaseUrl.slice(1)),
    onState: state => {
      if (state.phase === 'loading') status('loading', { progress: state.progress });
      if (state.phase === 'error') fail(state.error);
    },
    onFinal: segment => void chrome.runtime.sendMessage({ type: 'TRANSCRIPT_SEGMENT', segment }),
  });
  return recognizer;
};
const startSession = (streamId: string): Promise<void> => {
  if (starting || capture) return Promise.reject(new Error('Capture already running.'));
  if (stopping) {
    const pending = stopping;
    return (async () => {
      try {
        await pending;
      } catch {
        /* A new owner can retry a failed session. */
      }
      await startSession(streamId);
    })();
  }
  starting = (async () => {
    await Promise.resolve();
    try {
      error = undefined;
      status('loading');
      const current = getRecognizer();
      await current.start();
      if (error) throw new Error(error);
      const reportInputLevel = createAudioLevelReporter(level => {
        void chrome.runtime.sendMessage({ type: 'CAPTURE_LEVEL', source: 'tab', level });
      }, 16_000);
      capture = createCapture(
        samples => {
          reportInputLevel(samples);
          if (!error) {
            try {
              current.write(samples, 16_000);
            } catch (error_) {
              fail(error_);
            }
          }
        },
        samples =>
          void chrome.runtime.sendMessage({
            type: 'CAPTURE_LEVEL',
            source: 'mic',
            level: audioLevel(samples),
          })
      );
      const { micConnected } = await capture.start(streamId);
      if (error) throw new Error(error);
      status('recording', { micConnected });
    } catch (error_) {
      try {
        const active = capture;
        capture = undefined;
        await active?.stop();
      } finally {
        const current = recognizer;
        recognizer = undefined;
        try {
          await current?.dispose();
        } finally {
          fail(error_);
        }
      }
      throw error_;
    } finally {
      starting = undefined;
    }
  })();
  return starting;
};
const stopSession = () => {
  if (stopping) return stopping;
  stopping = (async () => {
    try {
      try {
        await starting;
      } catch {
        /* Release any resources left after startup fails. */
      }
      const active = capture;
      capture = undefined;
      try {
        await active?.stop();
      } finally {
        await recognizer?.stop();
      }
      if (!error) status('idle');
    } catch (error_) {
      fail(error_);
      throw error_;
    } finally {
      try {
        if (error) {
          const current = recognizer;
          recognizer = undefined;
          await current?.dispose();
        }
      } finally {
        stopping = undefined;
      }
    }
  })();
  return stopping;
};

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type !== 'OFFSCREEN_START' && message.type !== 'OFFSCREEN_STOP') return;
  void (async () => {
    try {
      await (message.type === 'OFFSCREEN_START' ? startSession(message.streamId) : stopSession());
      respond({ ok: true });
    } catch (error_) {
      respond({ ok: false, error: error_ instanceof Error ? error_.message : String(error_) });
    }
  })();
  return true;
});

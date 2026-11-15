import { createCapture } from './capture';

let capture: ReturnType<typeof createCapture> | undefined;
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === 'OFFSCREEN_START') {
    (async () => {
      try {
        if (capture) throw new Error('Capture already running.');
        capture = createCapture(() => {
          /* Connect a transcriber here. */
        });
        const { micConnected } = await capture.start(message.streamId);
        void chrome.runtime.sendMessage({
          type: 'CAPTURE_STATUS',
          phase: 'recording',
          micConnected,
        });
        respond({ ok: true });
      } catch (error) {
        capture = undefined;
        respond({ ok: false, error: String(error) });
      }
    })();
    return true;
  }
  if (message.type === 'OFFSCREEN_STOP') {
    (async () => {
      await capture?.stop();
      capture = undefined;
      void chrome.runtime.sendMessage({ type: 'CAPTURE_STATUS', phase: 'idle' });
      respond({ ok: true });
    })();
    return true;
  }
});

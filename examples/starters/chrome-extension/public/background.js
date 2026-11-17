// MV3 lifecycle: a user gesture in the extension starts capture on the active tab.
let starting = false;
let transcriptWrites = Promise.resolve();

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type === 'TRANSCRIPT_SEGMENT') {
    const previous = transcriptWrites;
    transcriptWrites = (async () => {
      try {
        await previous;
        const { segments = [] } = await chrome.storage.session.get('segments');
        await chrome.storage.session.set({ segments: [...segments, message.segment].slice(-200) });
      } catch {
        // Storage failure must not interrupt capture; the open panel still receives the message.
      }
    })();
    return;
  }
  if (message.type === 'CLEAR_TRANSCRIPT') {
    void (async () => {
      try {
        await transcriptWrites;
        await chrome.storage.session.remove('segments');
        respond({ ok: true });
      } catch (error) {
        respond({ ok: false, error: String(error) });
      }
    })();
    return true;
  }
  if (message.type === 'CAPTURE_STATUS') {
    void chrome.storage.session.set({
      capture: {
        phase: message.phase,
        progress: message.progress,
        error: message.error,
        micConnected: message.micConnected,
      },
    });
    return;
  }
  if (message.type === 'CAPTURE_DIAGNOSTICS') {
    const { tab, mic, capturedSeconds, forwardedSeconds, provisional, final, ready } = message;
    void chrome.storage.session.set({
      diagnostics: { tab, mic, capturedSeconds, forwardedSeconds, provisional, final, ready },
    });
    return;
  }
  if (message.type === 'START_CAPTURE') {
    if (starting) {
      respond({ ok: false, error: 'Capture is already running.' });
      return;
    }
    starting = true;
    (async () => {
      let created = false;
      try {
        if (await chrome.offscreen.hasDocument()) {
          const { capture } = await chrome.storage.session.get('capture');
          if (capture?.phase !== 'error')
            throw new Error('Capture is already running. Stop it first.');
          await chrome.offscreen.closeDocument();
        }
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !/^https?:/.test(tab.url ?? ''))
          throw new Error('Open a regular browser tab first.');
        await chrome.offscreen.createDocument({
          url: 'offscreen.html',
          reasons: ['USER_MEDIA'],
          justification: 'Transcribe tab and optional microphone audio locally into Katakit turns.',
        });
        created = true;
        // Single-use stream IDs expire within seconds: request it only after
        // the consumer document exists, then redeem it before model loading.
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
        const result = await chrome.runtime.sendMessage({ type: 'OFFSCREEN_START', streamId });
        if (!result?.ok) throw new Error(result?.error || 'Could not start capture.');
        respond({ ok: true });
      } catch (error) {
        if (created && (await chrome.offscreen.hasDocument()))
          await chrome.offscreen.closeDocument();
        respond({ ok: false, error: String(error) });
      } finally {
        starting = false;
      }
    })();
    return true;
  }
  if (message.type === 'STOP_CAPTURE') {
    (async () => {
      try {
        if (await chrome.offscreen.hasDocument()) {
          const result = await chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' });
          if (!result?.ok) throw new Error(result?.error || 'Could not stop capture.');
          await transcriptWrites;
          await chrome.offscreen.closeDocument();
        }
        await chrome.storage.session.set({ capture: { phase: 'idle' } });
        respond({ ok: true });
      } catch (error) {
        respond({ ok: false, error: String(error) });
      }
    })();
    return true;
  }
});

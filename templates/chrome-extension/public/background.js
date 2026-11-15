// MV3 lifecycle: a user gesture in the extension starts capture on the active tab.
let starting = false;
let transcriptWrites = Promise.resolve();
let recovering = Promise.resolve();

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type === 'CAPTURE_STATUS') {
    void chrome.storage.session.set({
      capture: {
        phase: message.phase,
        progress: message.progress,
        error: message.error,
        micConnected: message.micConnected,
      },
    });
    if (message.phase === 'error') {
      recovering = (async () => {
        try {
          if (await chrome.offscreen.hasDocument()) await chrome.offscreen.closeDocument();
        } catch {
          // A later Start still checks whether the document exists.
        }
      })();
    }
    return;
  }
  if (message.type === 'TRANSCRIPT_SEGMENT') {
    const previous = transcriptWrites;
    transcriptWrites = (async () => {
      try {
        await previous;
        const { segments = [] } = await chrome.storage.session.get('segments');
        await chrome.storage.session.set({ segments: [...segments, message.segment].slice(-2000) });
      } catch {
        /* Storage failure must not stop audio capture. */
      }
    })();
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
        await recovering;
        if (await chrome.offscreen.hasDocument()) {
          const { capture } = await chrome.storage.session.get('capture');
          if (capture?.phase !== 'error')
            throw new Error('Capture is already running. Stop it first.');
          await chrome.offscreen.closeDocument();
        }
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !/^https?:/.test(tab.url ?? ''))
          throw new Error('Open a regular browser tab first.');
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
        await chrome.offscreen.createDocument({
          url: 'offscreen.html',
          reasons: ['USER_MEDIA'],
          justification: 'Capture meeting tab audio and microphone for local processing.',
        });
        created = true;
        await transcriptWrites;
        await chrome.storage.session.set({ segments: [] });
        void chrome.runtime.sendMessage({ type: 'CAPTURE_RESET' });
        const result = await chrome.runtime.sendMessage({ type: 'OFFSCREEN_START', streamId });
        if (!result?.ok) throw new Error(result?.error || 'Could not start capture.');
        respond({ ok: true });
      } catch (error) {
        await recovering;
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
          await chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' });
          await transcriptWrites;
          await chrome.offscreen.closeDocument();
        }
        respond({ ok: true });
      } catch (error) {
        respond({ ok: false, error: String(error) });
      }
    })();
    return true;
  }
});

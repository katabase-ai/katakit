// MV3 lifecycle: a user gesture in the extension starts capture on the active tab.
let starting = false;
let startTask;
let transcriptWrites = Promise.resolve();
let recovering = Promise.resolve();

// Transport snapshots, not a second application projection. The panel validates again
// before seeding its event log. Keep first delivery order and the latest 2000 identities.
const validSegment = segment =>
  segment &&
  typeof segment === 'object' &&
  typeof segment.id === 'string' &&
  !!segment.id &&
  typeof segment.sourceId === 'string' &&
  !!segment.sourceId &&
  typeof segment.text === 'string' &&
  !!segment.text.trim() &&
  (segment.speaker === undefined || typeof segment.speaker === 'string') &&
  [segment.startMs, segment.endMs].every(
    time => time === undefined || (typeof time === 'number' && Number.isFinite(time) && time >= 0)
  ) &&
  (segment.startMs === undefined ||
    segment.endMs === undefined ||
    segment.startMs <= segment.endMs);
const writeTranscript = operation => {
  const previous = transcriptWrites;
  transcriptWrites = (async () => {
    try {
      await previous;
      await operation();
    } catch {
      /* Storage failure must not stop audio capture. */
    }
  })();
  return transcriptWrites;
};

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
          if (await chrome.offscreen.hasDocument()) {
            try {
              await chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' });
            } finally {
              await transcriptWrites;
              await chrome.offscreen.closeDocument();
            }
          }
        } catch {
          // A later Start still checks whether the document exists.
        }
      })();
    }
    return;
  }
  if (message.type === 'BINGO_NEW_ROUND') {
    void writeTranscript(() => chrome.storage.session.set({ segments: [] }));
    return;
  }
  if (message.type === 'TRANSCRIPT_SEGMENT') {
    if (!validSegment(message.segment)) return;
    void writeTranscript(async () => {
      const { segments } = await chrome.storage.session.get('segments');
      const seen = new Set();
      const retained = [...(Array.isArray(segments) ? segments : []), message.segment]
        .filter(segment => {
          if (!validSegment(segment)) return false;
          const key = JSON.stringify([segment.sourceId, segment.id]);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(-2000);
      await chrome.storage.session.set({ segments: retained });
    });
    return;
  }
  if (message.type === 'START_CAPTURE') {
    if (starting) {
      respond({ ok: false, error: 'Capture is already running.' });
      return;
    }
    starting = true;
    startTask = (async () => {
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
        await writeTranscript(() => chrome.storage.session.set({ segments: [] }));
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
        await startTask;
        if (await chrome.offscreen.hasDocument()) {
          try {
            const result = await chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' });
            if (!result?.ok) throw new Error(result?.error || 'Could not stop capture.');
          } finally {
            await transcriptWrites;
            await chrome.offscreen.closeDocument();
          }
        }
        respond({ ok: true });
      } catch (error) {
        respond({ ok: false, error: String(error) });
      }
    })();
    return true;
  }
});

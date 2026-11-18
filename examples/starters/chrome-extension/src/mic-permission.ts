export {};

const button = document.querySelector<HTMLButtonElement>('#request')!;
const status = document.querySelector<HTMLElement>('#status')!;

const requestAccess = async () => {
  button.disabled = true;
  status.textContent = 'Requesting microphone access…';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    status.textContent = 'Microphone access granted. Returning to your tab…';
    try {
      await chrome.storage.session.set({ micPermission: 'Microphone: enabled' });
    } catch {
      // The grant remains valid even if session storage is unavailable.
    }
    try {
      await chrome.runtime.sendMessage({ type: 'MIC_PERMISSION_GRANTED' });
    } catch {
      // The side panel may be closed while the permission tab is active.
    }
    const returnTab = Number(new URL(location.href).searchParams.get('return'));
    if (Number.isInteger(returnTab) && returnTab > 0) {
      try {
        await chrome.tabs.update(returnTab, { active: true });
      } catch {
        // The original tab may have been closed while the permission prompt was open.
      }
    }
    try {
      const setupTab = await chrome.tabs.getCurrent();
      if (setupTab?.id) await chrome.tabs.remove(setupTab.id);
    } catch {
      status.textContent =
        'Microphone access granted. Return to your audio tab to start recording.';
    }
  } catch (error) {
    const reason = error instanceof Error ? error.name : String(error);
    status.textContent = `Microphone access unavailable (${reason}). Check Chrome’s microphone site settings for this extension and try again.`;
    button.hidden = false;
  } finally {
    button.disabled = false;
  }
};

button.onclick = requestAccess;
void requestAccess();

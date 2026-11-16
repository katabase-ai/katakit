export {};

const button = document.querySelector<HTMLButtonElement>('#request')!;
const status = document.querySelector<HTMLElement>('#status')!;

button.onclick = async () => {
  button.disabled = true;
  status.textContent = 'Requesting microphone access…';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    status.textContent = 'Microphone access granted. Return to your audio tab and start recording.';
  } catch (error) {
    const reason = error instanceof Error ? error.name : String(error);
    status.textContent = `Microphone access unavailable (${reason}). Check Chrome’s microphone site settings for this extension and try again.`;
  } finally {
    button.disabled = false;
  }
};

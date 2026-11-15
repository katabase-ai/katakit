export {};
const button = document.querySelector<HTMLButtonElement>('#toggle')!;
const status = document.querySelector<HTMLElement>('#status')!;
let recording = false;
const show = (text: string) => {
  status.textContent = text;
  button.textContent = recording ? 'Stop capture' : 'Start capture';
};
chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'CAPTURE_STATUS') {
    recording = message.phase === 'recording';
    show(
      recording ? `Listening${message.micConnected ? ' to tab and mic' : ' to tab only'}` : 'Ready'
    );
  }
});
button.onclick = async () => {
  button.disabled = true;
  const result = await chrome.runtime.sendMessage({
    type: recording ? 'STOP_CAPTURE' : 'START_CAPTURE',
  });
  if (result?.ok) recording = !recording;
  show(result?.ok ? (recording ? 'Listening' : 'Ready') : result?.error || 'Capture failed');
  button.disabled = false;
};

import './style.css';

document.querySelector<HTMLButtonElement>('#open')!.onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.windowId !== undefined) await chrome.sidePanel.open({ windowId: tab.windowId });
  window.close();
};

import { beforeEach, expect, test, vi } from 'vitest';

let button: { disabled: boolean; hidden: boolean; onclick?: () => Promise<void> };
let status: { textContent: string };
let requestMic: ReturnType<typeof vi.fn>;
let stopTrack: ReturnType<typeof vi.fn>;
let updateTab: ReturnType<typeof vi.fn>;
let removeTab: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  button = { disabled: false, hidden: true };
  status = { textContent: '' };
  stopTrack = vi.fn();
  requestMic = vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] }));
  vi.stubGlobal('document', {
    querySelector: (selector: string) => ({ '#request': button, '#status': status })[selector],
  });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: requestMic } });
  vi.stubGlobal('location', { href: 'chrome-extension://starter/mic-permission.html?return=42' });
  updateTab = vi.fn(async () => ({}));
  removeTab = vi.fn(async () => {});
  vi.stubGlobal('chrome', {
    runtime: { sendMessage: vi.fn(async () => ({})) },
    tabs: { update: updateTab, getCurrent: vi.fn(async () => ({ id: 17 })), remove: removeTab },
    storage: { session: { set: vi.fn(async () => {}) } },
  });
});

test('requests access on opening and returns to the original tab after a grant', async () => {
  await import('./mic-permission');
  await vi.waitFor(() => expect(removeTab).toHaveBeenCalledWith(17));
  expect(requestMic).toHaveBeenCalledWith({ audio: true });
  expect(stopTrack).toHaveBeenCalledOnce();
  expect(updateTab).toHaveBeenCalledWith(42, { active: true });
  expect(button.disabled).toBe(false);
  expect(status.textContent).toContain('granted');
});

test('shows blocked permission and allows retry', async () => {
  requestMic.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'));
  await import('./mic-permission');
  await vi.waitFor(() => expect(status.textContent).toContain('NotAllowedError'));
  expect(button.hidden).toBe(false);
  expect(removeTab).not.toHaveBeenCalled();
  expect(status.textContent).toContain('NotAllowedError');
  expect(button.disabled).toBe(false);
  await button.onclick?.();
  expect(removeTab).toHaveBeenCalledWith(17);
});

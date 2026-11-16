import { beforeEach, expect, test, vi } from 'vitest';

let button: { disabled: boolean; onclick?: () => Promise<void> };
let status: { textContent: string };
let requestMic: ReturnType<typeof vi.fn>;
let stopTrack: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  button = { disabled: false };
  status = { textContent: '' };
  stopTrack = vi.fn();
  requestMic = vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] }));
  vi.stubGlobal('document', {
    querySelector: (selector: string) => ({ '#request': button, '#status': status })[selector],
  });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: requestMic } });
  await import('./mic-permission');
});

test('requests permission on a visible button click and releases the temporary track', async () => {
  expect(requestMic).not.toHaveBeenCalled();
  await button.onclick?.();
  expect(requestMic).toHaveBeenCalledWith({ audio: true });
  expect(stopTrack).toHaveBeenCalledOnce();
  expect(button.disabled).toBe(false);
  expect(status.textContent).toContain('granted');
});

test('shows blocked permission and allows retry', async () => {
  requestMic.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'));
  await button.onclick?.();
  expect(status.textContent).toContain('NotAllowedError');
  expect(button.disabled).toBe(false);
  await button.onclick?.();
  expect(status.textContent).toContain('granted');
});

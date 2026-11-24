import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ValuePreview } from './value-preview';

afterEach(cleanup);

test('inspects nested fields on demand without invoking getters or serialization hooks', () => {
  const hook = vi.fn();
  const ownKeys = vi.fn(Reflect.ownKeys);
  const nested = new Proxy(
    {
      toJSON: hook,
      get secret() {
        return hook();
      },
    },
    { ownKeys }
  );
  const payload = { nested, self: {} };
  payload.self = payload;
  const view = render(<ValuePreview value={payload} />);
  const toggle = view.getByRole('button', { name: /"nested"/ });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(view.queryByText(/"secret"/)).toBeNull();
  expect(ownKeys).not.toHaveBeenCalled();
  expect(view.getByText(/"self": \[circular\]/)).toBeTruthy();
  fireEvent.click(toggle);
  expect(view.getByText(/"secret": \[accessor\]/)).toBeTruthy();
  expect(view.getByText(/"toJSON": \[function\]/)).toBeTruthy();
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(hook).not.toHaveBeenCalled();
});

test('pages through audio samples without reading a shadowed length or rendering the whole buffer', () => {
  const samples = new Float32Array(65_536);
  samples[32] = 0.5;
  const getter = vi.fn(() => {
    throw new Error('unexpected read');
  });
  Object.defineProperty(samples, 'length', { get: getter });
  const view = render(<ValuePreview value={samples} />);
  expect(view.queryByText('32: 0.5')).toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Next fields' }));
  expect(view.getByText('32: 0.5')).toBeTruthy();
  expect(view.queryByText('0: 0')).toBeNull();
  expect(getter).not.toHaveBeenCalled();
});

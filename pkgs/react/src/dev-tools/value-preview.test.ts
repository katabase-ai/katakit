import { expect, test, vi } from 'vitest';
import { valueText } from './value-preview';

test('inspecting a payload does not invoke its getters or serialization hooks', () => {
  const hook = vi.fn(() => 'application code');
  const payload = {
    nested: {
      toJSON: hook,
      get secret() {
        return hook();
      },
    },
  };
  expect(JSON.parse(valueText(payload))).toEqual({
    nested: { toJSON: '[function]', secret: '[accessor]' },
  });
  expect(hook).not.toHaveBeenCalled();
});

test('previews a bounded prefix of audio samples, even with a shadowed length getter', () => {
  const samples = new Float32Array(65_536).fill(0.5);
  Object.defineProperty(samples, 'length', {
    get() {
      throw new Error('unexpected read');
    },
  });
  expect(JSON.parse(valueText(samples))).toEqual(Array(6).fill(0.5));
});

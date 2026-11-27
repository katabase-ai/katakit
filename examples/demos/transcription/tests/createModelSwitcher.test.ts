import { describe, expect, it, vi } from 'vitest';
import { createModelSwitcher } from '../src/transcription/createModelSwitcher';

describe('model switching', () => {
  it('waits for disposal before creating the replacement and retains the selected model', async () => {
    const disposal = Promise.withResolvers<void>();
    const events: string[] = [];
    const create = vi.fn((id: string) => {
      events.push(`create ${id}`);
      return {
        start: async () => {
          events.push(`start ${id}`);
        },
        stop: async () => {
          events.push(`stop ${id}`);
        },
        dispose: async () => {
          events.push(`dispose ${id}`);
          if (id === 'moonshine-small') await disposal.promise;
        },
      };
    });
    const switcher = createModelSwitcher('moonshine-small', create);
    const change = switcher.select('whisper-tiny');
    expect(switcher.busy).toBe(true);
    expect(await switcher.select('moonshine-medium')).toBe(false);
    await switcher.start();
    expect(events).toEqual(['create moonshine-small', 'dispose moonshine-small']);
    disposal.resolve();
    expect(await change).toBe(true);
    expect(switcher.modelId).toBe('whisper-tiny');
    await switcher.start();
    await switcher.stop();
    expect(events).toEqual([
      'create moonshine-small',
      'dispose moonshine-small',
      'create whisper-tiny',
      'start whisper-tiny',
      'stop whisper-tiny',
    ]);
  });

  it('unmount during model disposal prevents replacement and disposes once', async () => {
    const pending = Promise.withResolvers<void>();
    const dispose = vi.fn(() => pending.promise);
    const create = vi.fn(() => ({
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
      dispose,
    }));
    const switcher = createModelSwitcher('moonshine-small', create);
    const selection = switcher.select('whisper-tiny');
    const teardown = switcher.dispose();
    expect(await switcher.select('moonshine-medium')).toBe(false);
    pending.resolve();
    expect(await selection).toBe(false);
    await teardown;
    await switcher.dispose();
    expect(create).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledOnce();
  });
});

// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { BrainstormDemo } from '../../brainstorm-react/src/BrainstormDemo';
import { createBrainstormDemo } from '../../brainstorm-react/src/createBrainstormDemo';
import { findChallenge } from '../../brainstorm-react/src/challenges';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const openSettings = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Game settings' }));
  return within(screen.getByRole('dialog', { name: 'Game settings' }));
};

test('the challenge, rule and examples are revealed only after Start, including after setup changes', () => {
  const runtime = createBrainstormDemo();
  const view = render(<BrainstormDemo runtime={runtime} />);
  const original = findChallenge(runtime.state$.value.challengeId);
  expect(screen.queryByText(original.prompt)).toBeNull();
  expect(screen.queryByText(original.judgingRule)).toBeNull();
  expect(screen.queryByText(/only these examples count/)).toBeNull();
  expect(screen.queryByRole('combobox')).toBeNull();
  const settings = openSettings();
  expect((settings.getByLabelText('Round length') as HTMLSelectElement).value).toBe('60');
  fireEvent.change(settings.getByLabelText('Round length'), { target: { value: '30' } });
  fireEvent.click(settings.getByRole('button', { name: 'Apply' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  const hidden = findChallenge(runtime.state$.value.challengeId);
  expect(screen.queryByText(hidden.prompt)).toBeNull();
  expect(screen.queryByText(hidden.judgingRule)).toBeNull();
  expect(screen.queryByText(/only these examples count/)).toBeNull();
  fireEvent.click(screen.getByLabelText('Use typed answers'));
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  expect(screen.getByRole('button', { name: 'Game settings' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('heading', { name: hidden.prompt })).toBeDefined();
  expect(screen.getByText(hidden.judgingRule)).toBeDefined();
  expect(screen.getByText(/only these examples count/).textContent).toContain(
    hidden.sampleAnswers[0]
  );
  act(() => {
    runtime.finish();
    runtime.flush();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Next round' }));
  expect(runtime.state$.value.challengeId).not.toBe(hidden.id);
  expect(runtime.state$.value.phase).toBe('running');
  expect(screen.queryByRole('heading', { name: hidden.prompt })).toBeNull();
  view.unmount();
  runtime.close();
});

test.each([
  ['30', 30],
  ['60', 60],
  ['120', 120],
] as const)('round length %s drives the clock and deadline', async (value, seconds) => {
  vi.useFakeTimers();
  const runtime = createBrainstormDemo();
  const stop = vi.fn(async () => {});
  const view = render(<BrainstormDemo runtime={runtime} stopListening={stop} />);
  const settings = openSettings();
  expect(
    Array.from(
      (settings.getByLabelText('Round length') as HTMLSelectElement).options,
      option => option.text
    )
  ).toEqual(['30s', '1min', '2min', 'Unlimited']);
  fireEvent.change(settings.getByLabelText('Round length'), { target: { value } });
  fireEvent.click(settings.getByRole('button', { name: 'Apply' }));
  fireEvent.click(screen.getByLabelText('Use typed answers'));
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  expect(runtime.state$.value.seconds).toBe(seconds);
  await act(async () => {
    vi.advanceTimersByTime((seconds - 1) * 1000);
  });
  expect(runtime.state$.value.remaining).toBe(1);
  expect(runtime.state$.value.phase).toBe('running');
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  expect(runtime.state$.value.remaining).toBe(0);
  expect(runtime.state$.value.phase).toBe('finished');
  expect(stop).toHaveBeenCalledOnce();
  view.unmount();
  runtime.close();
});

test('typed practice plays a full round, removes a note, and changes to untimed play', async () => {
  const runtime = createBrainstormDemo();
  const stop = vi.fn(async () => {});
  const view = render(<BrainstormDemo runtime={runtime} stopListening={stop} />);
  expect(screen.getByRole('button', { name: 'Start round' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByLabelText('Use typed answers'));
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  fireEvent.change(screen.getByLabelText('Your answers'), {
    target: { value: 'dolphin octopus bicycle' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add answers' }));
  expect(screen.getByRole('button', { name: 'Remove dolphin' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Remove Octopus' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Remove bicycle' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Remove dolphin' }));
  fireEvent.click(screen.getByRole('button', { name: 'End round' }));
  await act(async () => {});
  expect(stop).toHaveBeenCalledOnce();
  expect(runtime.state$.value.phase).toBe('finished');
  vi.useFakeTimers();
  const settings = openSettings();
  fireEvent.change(settings.getByLabelText('Round length'), { target: { value: 'unlimited' } });
  fireEvent.click(settings.getByRole('button', { name: 'Apply' }));
  expect(runtime.state$.value.seconds).toBeNull();
  expect(runtime.state$.value.notes).toEqual([]);
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  expect(screen.getByRole('timer').textContent).toBe('Unlimited');
  await act(async () => {
    vi.advanceTimersByTime(300_000);
  });
  expect(runtime.state$.value.phase).toBe('running');
  expect(stop).toHaveBeenCalledOnce();
  view.unmount();
  runtime.close();
});

test('settings drafts can be canceled without clearing the board and applied together', async () => {
  const runtime = createBrainstormDemo();
  const view = render(<BrainstormDemo runtime={runtime} listening />);
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  act(() => {
    runtime.submitText('dolphin');
    runtime.finish();
  });
  await act(async () => {});
  const previous = runtime.state$.value;
  let settings = openSettings();
  fireEvent.change(settings.getByLabelText('Category'), { target: { value: 'animals' } });
  fireEvent.change(settings.getByLabelText('Round length'), { target: { value: '120' } });
  expect(runtime.state$.value).toBe(previous);
  fireEvent.click(settings.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', { name: 'Remove dolphin' })).toBeDefined();
  settings = openSettings();
  expect((settings.getByLabelText('Category') as HTMLSelectElement).value).toBe('');
  expect((settings.getByLabelText('Round length') as HTMLSelectElement).value).toBe('60');
  fireEvent.click(settings.getByRole('button', { name: 'Apply' }));
  expect(runtime.state$.value).toBe(previous);
  settings = openSettings();
  fireEvent.change(settings.getByLabelText('Category'), { target: { value: 'animals' } });
  fireEvent.change(settings.getByLabelText('Round length'), { target: { value: '120' } });
  fireEvent.click(settings.getByRole('button', { name: 'Apply' }));
  expect(runtime.state$.value.seconds).toBe(120);
  expect(runtime.state$.value.challengeId).toMatch(/^animals-/);
  expect(runtime.state$.value.phase).toBe('idle');
  expect(runtime.state$.value.notes).toEqual([]);
  expect(screen.getByText('Animals · 2min')).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Ready when you are.' })).toBeDefined();
  view.unmount();
  runtime.close();
});

test('countdown stops the shared microphone once and retains its drained final result', async () => {
  vi.useFakeTimers();
  const runtime = createBrainstormDemo();
  const stop = vi.fn(async () => {
    runtime.ingestSegment({ id: 'last', sourceId: 'mic', text: 'dolphin' });
    runtime.flush();
  });
  const view = render(<BrainstormDemo runtime={runtime} listening stopListening={stop} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await act(async () => {
    vi.advanceTimersByTime(60_000);
  });
  expect(stop).toHaveBeenCalledOnce();
  expect(runtime.state$.value.phase).toBe('finished');
  expect(screen.getByRole('button', { name: 'Remove dolphin' })).toBeDefined();
  view.unmount();
  runtime.close();
  expect(vi.getTimerCount()).toBe(0);
});

test('failed admission needs explicit retry and unmount aborts an in-flight admission', async () => {
  const runtime = createBrainstormDemo();
  let signal!: AbortSignal;
  const connect = vi.fn(async (input: { signal: AbortSignal }) => {
    signal = input.signal;
    throw new Error('offline');
  });
  const view = render(<BrainstormDemo runtime={runtime} listening connect={connect} />);
  expect(connect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Connect judge' }));
  await screen.findByRole('button', { name: 'Retry connection' });
  expect(connect).toHaveBeenCalledOnce();
  view.rerender(<BrainstormDemo runtime={runtime} listening={false} connect={connect} />);
  view.rerender(<BrainstormDemo runtime={runtime} listening connect={connect} />);
  expect(connect).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Retry connection' }));
  await act(async () => {});
  expect(connect).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(signal.aborted).toBe(true);
  runtime.close();
});

test('completion of an old microphone stop cannot seal a newly started round', async () => {
  const runtime = createBrainstormDemo();
  let complete!: () => void;
  const stop = vi.fn(async () => {
    runtime.flush();
    await new Promise<void>(resolve => {
      complete = resolve;
    });
  });
  const view = render(<BrainstormDemo runtime={runtime} listening stopListening={stop} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  fireEvent.click(screen.getByRole('button', { name: 'End round' }));
  expect(runtime.state$.value.phase).toBe('finished');
  fireEvent.click(screen.getByRole('button', { name: 'Next round' }));
  await act(async () => {
    complete();
  });
  expect(runtime.state$.value.phase).toBe('running');
  view.unmount();
  runtime.close();
});

test('the next round waits for in-flight judging so late answers remain visible', async () => {
  const runtime = createBrainstormDemo();
  let complete!: (value: unknown) => void;
  const connect = vi.fn(async () => ({
    model: 'test-model',
    maxBodyBytes: 16384,
    maxOutputTokens: 1024,
    requestCompletion: () =>
      new Promise(resolve => {
        complete = resolve;
      }),
  }));
  const view = render(<BrainstormDemo runtime={runtime} listening connect={connect} />);
  fireEvent.click(screen.getByRole('button', { name: 'Connect judge' }));
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  act(() => {
    runtime.submitText('seal');
    runtime.finish();
  });
  await act(async () => {});
  expect(runtime.state$.value.phase).toBe('finished');
  expect((screen.getByRole('button', { name: 'Next round' }) as HTMLButtonElement).disabled).toBe(
    true
  );
  await act(async () => {
    complete({
      choices: [
        {
          finish_reason: 'stop',
          message: { content: JSON.stringify({ answers: [{ text: 'Seal', evidence: 'seal' }] }) },
        },
      ],
    });
  });
  expect(screen.getByRole('button', { name: 'Remove Seal' })).toBeDefined();
  expect((screen.getByRole('button', { name: 'Next round' }) as HTMLButtonElement).disabled).toBe(
    false
  );
  view.unmount();
  runtime.close();
});

test('inference source changes abort judging, retain the board, and require a new explicit connection', async () => {
  const runtime = createBrainstormDemo();
  const result = (text: string, evidence: string) => ({
    choices: [
      {
        finish_reason: 'stop',
        message: { content: JSON.stringify({ answers: [{ text, evidence }] }) },
      },
    ],
  });
  let complete!: (value: unknown) => void;
  let requestSignal!: AbortSignal;
  const request = vi
    .fn()
    .mockResolvedValueOnce(result('Seal', 'seal'))
    .mockImplementationOnce(({ signal }: { signal: AbortSignal }) => {
      requestSignal = signal;
      return new Promise(resolve => {
        complete = resolve;
      });
    });
  const connect = vi.fn(async () => ({
    model: 'test-model',
    maxBodyBytes: 16384,
    maxOutputTokens: 1024,
    requestCompletion: request,
  }));
  const stop = vi.fn(async () => {});
  const view = render(
    <BrainstormDemo runtime={runtime} listening stopListening={stop} connect={connect} />
  );
  expect(connect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Connect judge' }));
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await act(async () => {
    runtime.submitText('seal');
  });
  expect(screen.getByRole('button', { name: 'Remove Seal' })).toBeDefined();
  await act(async () => {
    runtime.submitText('orca');
  });
  view.rerender(<BrainstormDemo runtime={runtime} listening stopListening={stop} />);
  await act(async () => {});
  expect(requestSignal.aborted).toBe(true);
  expect(runtime.state$.value.connected).toBe(false);
  expect(runtime.state$.value.phase).toBe('finished');
  expect(runtime.state$.value.practice).toBe(true);
  expect(stop).toHaveBeenCalledOnce();
  await act(async () => {
    complete(result('Orca', 'orca'));
  });
  expect(runtime.state$.value.notes.map(note => note.text)).toEqual(['Seal']);
  view.rerender(
    <BrainstormDemo runtime={runtime} listening stopListening={stop} connect={connect} />
  );
  await act(async () => {});
  expect(connect).toHaveBeenCalledOnce();
  expect((screen.getByRole('button', { name: 'Next round' }) as HTMLButtonElement).disabled).toBe(
    true
  );
  expect(screen.getByRole('button', { name: 'Connect judge' })).toBeDefined();
  expect(runtime.state$.value.notes.map(note => note.text)).toEqual(['Seal']);
  view.unmount();
  runtime.close();
});

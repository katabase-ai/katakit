// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { WordRushDemo as WordRushDemoView } from '../../examples/demos/word-rush/src/WordRushDemo';
import { createWordRushDemo } from '../../examples/demos/word-rush/src/createWordRushDemo';
import { findChallenge } from '../../examples/demos/word-rush/src/challenges';

const decisions = {
  model: 'typesafe/jev-1.13',
  maxQuestions: 16,
  requestDecision: async ({ body }: { body: string }) => ({
    answers: Object.fromEntries(
      Object.keys(JSON.parse(body).questions).map(key => [key, { type: 'noul', noul: 0.99 }])
    ),
  }),
};

const defaultConnect = async () => ({
  model: 'test-model',
  maxBodyBytes: 16384,
  maxOutputTokens: 1024,
  decisions,
  requestCompletion: async () => ({
    choices: [{ finish_reason: 'stop', message: { content: '{"answers":[]}' } }],
  }),
});
const dolphinConnect = async () => ({
  ...(await defaultConnect()),
  requestCompletion: async () => ({
    choices: [
      {
        finish_reason: 'stop',
        message: {
          content: JSON.stringify({ answers: [{ text: 'dolphin', evidence: 'dolphin' }] }),
        },
      },
    ],
  }),
});
const WordRushDemo = (props: ComponentProps<typeof WordRushDemoView>) => (
  <WordRushDemoView listening connect={defaultConnect} {...props} />
);
const hear = (runtime: ReturnType<typeof createWordRushDemo>, text: string) =>
  runtime.ingestSegment({ id: crypto.randomUUID(), sourceId: 'test-mic', text });
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const openSettings = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Game settings' }));
  return within(screen.getByRole('dialog', { name: 'Game settings' }));
};

test('the transcript shows interim and finalized input newest first, keeps rejected words, and resets with the round', async () => {
  const runtime = createWordRushDemo();
  const view = render(<WordRushDemo runtime={runtime} listening />);
  const transcript = within(screen.getByRole('complementary', { name: 'Transcript' }));
  expect(transcript.getByText('Your words will appear here.')).toBeDefined();
  expect(screen.queryByText('What we heard')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await act(async () => {});
  act(() => runtime.updateProvisional('maybe a dolphin'));
  expect(transcript.getByRole('article', { name: 'In progress' }).textContent).toContain(
    'maybe a dolphin'
  );
  const original = '  dolphin, and also a bicycle.  ';
  act(() => runtime.ingestSegment({ id: 'one', sourceId: 'mic', text: original }));
  expect(transcript.queryByRole('article', { name: 'In progress' })).toBeNull();
  expect(transcript.getByRole('article', { name: 'Entry 1' }).querySelector('p')?.textContent).toBe(
    original
  );
  act(() => hear(runtime, 'I cannot think of anything else.'));
  expect(transcript.getAllByRole('article').map(entry => entry.getAttribute('aria-label'))).toEqual(
    ['Entry 2', 'Entry 1']
  );
  expect(transcript.getByText('I cannot think of anything else.')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Remove bicycle' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'End round' }));
  await act(async () => {});
  expect(transcript.getAllByRole('article')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Next round' }));
  await act(async () => {});
  expect(transcript.queryAllByRole('article')).toHaveLength(0);
  expect(transcript.getByText('Your words will appear here.')).toBeDefined();
  view.unmount();
  runtime.close();
});

test('the challenge and rule are revealed only after Start, including after setup changes', async () => {
  const runtime = createWordRushDemo();
  const view = render(<WordRushDemo runtime={runtime} />);
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
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await act(async () => {});
  expect(screen.getByRole('button', { name: 'Game settings' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('heading', { name: hidden.prompt })).toBeDefined();
  expect(screen.getByText(hidden.judgingRule)).toBeDefined();
  expect(screen.queryByText(/only these examples count/)).toBeNull();
  act(() => {
    runtime.finish();
    runtime.flush();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Next round' }));
  await act(async () => {});
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
  const runtime = createWordRushDemo();
  const stop = vi.fn(async () => {});
  const view = render(<WordRushDemo runtime={runtime} stopListening={stop} />);
  const settings = openSettings();
  expect(
    Array.from(
      (settings.getByLabelText('Round length') as HTMLSelectElement).options,
      option => option.text
    )
  ).toEqual(['30s', '1min', '2min', 'Unlimited']);
  fireEvent.change(settings.getByLabelText('Round length'), { target: { value } });
  fireEvent.click(settings.getByRole('button', { name: 'Apply' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await act(async () => {});
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

test('spoken answers are judged, corrected, and collected in timed and untimed rounds', async () => {
  const runtime = createWordRushDemo();
  const stop = vi.fn(async () => {});
  const connect = async () => ({
    ...(await defaultConnect()),
    requestCompletion: async () => ({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({
              answers: [
                { text: 'dolphin', evidence: 'dolphin' },
                { text: 'Octopus', evidence: 'octopus' },
              ],
            }),
          },
        },
      ],
    }),
  });
  const view = render(<WordRushDemo runtime={runtime} stopListening={stop} connect={connect} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await act(async () => {});
  await act(async () => {
    hear(runtime, 'dolphin octopus bicycle');
  });
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
  await act(async () => {});
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
  const runtime = createWordRushDemo();
  const view = render(<WordRushDemo runtime={runtime} listening connect={dolphinConnect} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await act(async () => {});
  act(() => {
    hear(runtime, 'dolphin');
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
  const runtime = createWordRushDemo();
  const stop = vi.fn(async () => {
    runtime.ingestSegment({ id: 'last', sourceId: 'mic', text: 'dolphin' });
    runtime.flush();
  });
  const view = render(
    <WordRushDemo runtime={runtime} listening stopListening={stop} connect={dolphinConnect} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await act(async () => {});
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

test('failed setup stays hidden, needs another Start, and unmount aborts admission', async () => {
  const runtime = createWordRushDemo();
  let signal!: AbortSignal;
  const connect = vi.fn(async (input: { signal: AbortSignal }) => {
    signal = input.signal;
    throw new Error('offline');
  });
  const view = render(<WordRushDemo runtime={runtime} listening connect={connect} />);
  expect(connect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await act(async () => {});
  await screen.findByRole('alert');
  expect(runtime.state$.value.phase).toBe('idle');
  expect(screen.getByRole('timer').textContent).toBe('1:00');
  expect(screen.queryByText(findChallenge(runtime.state$.value.challengeId).prompt)).toBeNull();
  expect(connect).toHaveBeenCalledOnce();
  view.rerender(<WordRushDemo runtime={runtime} listening={false} connect={connect} />);
  view.rerender(<WordRushDemo runtime={runtime} listening connect={connect} />);
  expect(connect).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await act(async () => {});
  await act(async () => {});
  expect(connect).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(signal.aborted).toBe(true);
  runtime.close();
});

test('completion of an old microphone stop cannot seal a newly started round', async () => {
  const runtime = createWordRushDemo();
  let complete!: () => void;
  const stop = vi.fn(async () => {
    runtime.flush();
    await new Promise<void>(resolve => {
      complete = resolve;
    });
  });
  const view = render(<WordRushDemo runtime={runtime} listening stopListening={stop} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'End round' }));
  expect(runtime.state$.value.phase).toBe('finished');
  fireEvent.click(screen.getByRole('button', { name: 'Next round' }));
  await act(async () => {});
  await act(async () => {
    complete();
  });
  expect(runtime.state$.value.phase).toBe('running');
  view.unmount();
  runtime.close();
});

test('the next round waits for in-flight judging so late answers remain visible', async () => {
  const runtime = createWordRushDemo();
  let complete!: (value: unknown) => void;
  const connect = vi.fn(async () => ({
    model: 'test-model',
    maxBodyBytes: 16384,
    maxOutputTokens: 1024,
    decisions,
    requestCompletion: () =>
      new Promise(resolve => {
        complete = resolve;
      }),
  }));
  const view = render(<WordRushDemo runtime={runtime} listening connect={connect} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await act(async () => {});
  await act(async () => {});
  act(() => {
    hear(runtime, 'seal');
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

test('inference source changes abort judging, retain the board, and reconnect only on the next Start', async () => {
  const runtime = createWordRushDemo();
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
    decisions,
    requestCompletion: request,
  }));
  const stop = vi.fn(async () => {});
  const view = render(
    <WordRushDemo runtime={runtime} listening stopListening={stop} connect={connect} />
  );
  expect(connect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await act(async () => {});
  await act(async () => {});
  await act(async () => {
    hear(runtime, 'seal');
  });
  expect(screen.getByRole('button', { name: 'Remove Seal' })).toBeDefined();
  await act(async () => {
    hear(runtime, 'orca');
  });
  view.rerender(
    <WordRushDemo runtime={runtime} listening stopListening={stop} connect={undefined} />
  );
  await act(async () => {});
  expect(requestSignal.aborted).toBe(true);
  expect(runtime.state$.value.connected).toBe(false);
  expect(runtime.state$.value.phase).toBe('finished');
  expect(screen.getByRole('button', { name: 'Next round' }).hasAttribute('disabled')).toBe(true);
  expect(stop).toHaveBeenCalledOnce();
  await act(async () => {
    complete(result('Orca', 'orca'));
  });
  expect(runtime.state$.value.notes.map(note => note.text)).toEqual(['Seal']);
  view.rerender(
    <WordRushDemo runtime={runtime} listening stopListening={stop} connect={connect} />
  );
  await act(async () => {});
  expect(connect).toHaveBeenCalledOnce();
  expect((screen.getByRole('button', { name: 'Next round' }) as HTMLButtonElement).disabled).toBe(
    false
  );
  expect(runtime.state$.value.notes.map(note => note.text)).toEqual(['Seal']);
  fireEvent.click(screen.getByRole('button', { name: 'Next round' }));
  await act(async () => {});
  await act(async () => {});
  expect(connect).toHaveBeenCalledTimes(2);
  expect(runtime.state$.value.phase).toBe('running');
  view.unmount();
  runtime.close();
});

const deferred = <T,>() => {
  let complete!: (value: T) => void;
  const promise = new Promise<T>(resolve => {
    complete = resolve;
  });
  return { promise, resolve: complete };
};
const judge = () => ({
  model: 'test-model',
  maxBodyBytes: 16384,
  maxOutputTokens: 1024,
  decisions,
  requestCompletion: vi.fn(),
});

test('one Start waits for microphone and judge readiness without revealing the challenge or spending round time', async () => {
  vi.useFakeTimers();
  const runtime = createWordRushDemo();
  const microphone = deferred<boolean>();
  const admission = deferred<ReturnType<typeof judge>>();
  const startListening = vi.fn(() => microphone.promise);
  const connect = vi.fn(() => admission.promise);
  const view = render(
    <WordRushDemo
      runtime={runtime}
      startListening={startListening}
      isListening={() => true}
      connect={connect}
    />
  );
  const challenge = findChallenge(runtime.state$.value.challengeId);
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await act(async () => {});
  expect(startListening).toHaveBeenCalledOnce();
  expect(connect).not.toHaveBeenCalled();
  await act(async () => {
    vi.advanceTimersByTime(120_000);
  });
  expect(screen.queryByText(challenge.prompt)).toBeNull();
  expect(runtime.state$.value.phase).toBe('idle');
  expect(runtime.state$.value.remaining).toBe(60);
  expect(vi.getTimerCount()).toBe(0);
  await act(async () => {
    microphone.resolve(true);
  });
  expect(connect).toHaveBeenCalledOnce();
  await act(async () => {
    vi.advanceTimersByTime(90_000);
  });
  expect(screen.queryByText(challenge.prompt)).toBeNull();
  expect(screen.queryByText(challenge.judgingRule)).toBeNull();
  expect(screen.queryByText(/only these examples count/)).toBeNull();
  expect(runtime.state$.value.remaining).toBe(60);
  expect(runtime.state$.value.deadline).toBeNull();
  await act(async () => {
    admission.resolve(judge());
  });
  expect(runtime.state$.value.phase).toBe('running');
  expect(screen.getByRole('heading', { name: challenge.prompt })).toBeDefined();
  expect(runtime.state$.value.remaining).toBe(60);
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  expect(runtime.state$.value.remaining).toBe(59);
  view.unmount();
  runtime.close();
});

test.each(['microphone', 'judge'] as const)(
  'cancel during %s setup ignores late readiness and allows a fresh Start',
  async stage => {
    const runtime = createWordRushDemo();
    const microphone = deferred<boolean>();
    const admission = deferred<ReturnType<typeof judge>>();
    let micSignal!: AbortSignal;
    let judgeSignal: AbortSignal | undefined;
    const startListening = vi.fn((signal: AbortSignal) => {
      micSignal = signal;
      return stage === 'microphone' ? microphone.promise : Promise.resolve(true);
    });
    const stop = vi.fn(async () => {});
    const connect = vi.fn(({ signal }: { signal: AbortSignal }) => {
      judgeSignal = signal;
      return admission.promise;
    });
    const view = render(
      <WordRushDemo
        runtime={runtime}
        startListening={startListening}
        isListening={() => true}
        stopListening={stop}
        connect={connect}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
    await act(async () => {});
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Cancel setup' }));
    await act(async () => {});
    expect(micSignal.aborted).toBe(true);
    expect(judgeSignal?.aborted).toBe(stage === 'judge' ? true : undefined);
    expect(stop).toHaveBeenCalledOnce();
    await act(async () => {
      microphone.resolve(true);
      admission.resolve(judge());
    });
    expect(runtime.state$.value.phase).toBe('idle');
    expect(runtime.state$.value.connected).toBe(false);
    expect(runtime.state$.value.remaining).toBe(60);
    expect(screen.getByRole('heading', { name: 'Ready when you are.' })).toBeDefined();
    startListening.mockResolvedValue(true);
    connect.mockResolvedValue(judge());
    fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
    await act(async () => {});
    await act(async () => {});
    expect(runtime.state$.value.phase).toBe('running');
    view.unmount();
    runtime.close();
  }
);

test('microphone failure never admits a judge or reveals a challenge', async () => {
  const runtime = createWordRushDemo();
  const connect = vi.fn(async () => judge());
  const view = render(
    <WordRushDemo runtime={runtime} startListening={async () => false} connect={connect} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await act(async () => {});
  await act(async () => {});
  expect(connect).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('microphone');
  expect(runtime.state$.value.phase).toBe('idle');
  expect(runtime.state$.value.remaining).toBe(60);
  expect(runtime.state$.value.deadline).toBeNull();
  view.unmount();
  runtime.close();
});

test('a microphone stopped while the judge connects cannot start the clock', async () => {
  const runtime = createWordRushDemo();
  let ready = true;
  const admission = deferred<ReturnType<typeof judge>>();
  const connect = vi.fn(() => admission.promise);
  const view = render(
    <WordRushDemo runtime={runtime} listening isListening={() => ready} connect={connect} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await act(async () => {});
  ready = false;
  await act(async () => {
    admission.resolve(judge());
  });
  expect(runtime.state$.value.phase).toBe('idle');
  expect(screen.getByRole('alert').textContent).toContain('stopped during setup');
  view.unmount();
  runtime.close();
});

test('only microphone input with a configured judge is available', async () => {
  const runtime = createWordRushDemo();
  const startListening = vi.fn();
  const view = render(
    <WordRushDemo runtime={runtime} startListening={startListening} connect={undefined} />
  );
  expect(screen.getByRole('button', { name: 'Start round' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
  await act(async () => {});
  expect(startListening).not.toHaveBeenCalled();
  expect(runtime.state$.value.phase).toBe('idle');
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(
    screen.queryByText(/Sample practice|only these examples count|Use typed answers/)
  ).toBeNull();
  expect(runtime.state$.value.deadline).toBeNull();
  view.rerender(<WordRushDemo runtime={runtime} listening={false} />);
  expect(screen.getByRole('button', { name: 'Start round' }).hasAttribute('disabled')).toBe(true);
  view.unmount();
  runtime.close();
});

test.each(['microphone', 'judge'] as const)(
  'leaving during %s setup aborts it and ignores late readiness',
  async stage => {
    const runtime = createWordRushDemo();
    const microphone = deferred<boolean>();
    const admission = deferred<ReturnType<typeof judge>>();
    const startListening = vi.fn(() =>
      stage === 'microphone' ? microphone.promise : Promise.resolve(true)
    );
    let signal!: AbortSignal;
    const connect = vi.fn((input: { signal: AbortSignal }) => {
      signal = input.signal;
      return admission.promise;
    });
    const stop = vi.fn(async () => {});
    const view = render(
      <WordRushDemo
        runtime={runtime}
        startListening={startListening}
        isListening={() => true}
        stopListening={stop}
        connect={connect}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
    await act(async () => {});
    await act(async () => {});
    view.unmount();
    await act(async () => {
      microphone.resolve(true);
      admission.resolve(judge());
    });
    expect(stop).toHaveBeenCalledOnce();
    expect(stage === 'microphone' || signal.aborted).toBe(true);
    expect(runtime.state$.value.phase).toBe('idle');
    expect(runtime.state$.value.deadline).toBeNull();
    expect(runtime.state$.value.connected).toBe(false);
    runtime.close();
  }
);

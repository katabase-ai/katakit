import { afterEach, expect, test, vi } from 'vitest';
import { createListExtractionDemo, type ListExtractionRuntime } from './createListExtractionDemo';
import {
  ExtractionError,
  type ExtractionConnect,
  type ExtractionConnection,
} from './extractionModel';

const runtimes: ListExtractionRuntime[] = [];
const create = (initialEvents?: unknown) => {
  const runtime = createListExtractionDemo({ initialEvents });
  runtimes.push(runtime);
  return runtime;
};
const turn = (runtime: ListExtractionRuntime, text = 'I will email Sam tomorrow.') => {
  runtime.ingestSegment({
    id: crypto.randomUUID(),
    sourceId: 'mic',
    text,
    startMs: 4000,
    endMs: 9000,
  });
  runtime.flush();
};
const response = (runtime: ListExtractionRuntime, text = 'Email Sam') => ({
  choices: [
    {
      finish_reason: 'stop',
      message: {
        content: JSON.stringify({
          items: [
            {
              listId: 'actions',
              text,
              kind: 'commitment',
              owner: null,
              deadline: 'tomorrow',
              sources: [
                {
                  turnId: runtime.state$.get().turns[0]!.id,
                  quote: runtime.state$.get().turns[0]!.text,
                },
              ],
            },
          ],
        }),
      },
    },
  ],
});
const connection = (
  requestCompletion: ExtractionConnection['requestCompletion']
): ExtractionConnection => ({
  model: 'test',
  maxBodyBytes: 100000,
  maxOutputTokens: 2048,
  requestCompletion,
});
afterEach(() => {
  runtimes.splice(0).forEach(r => r.close());
  vi.useRealTimers();
});

test('dictation stays local; explicit extraction flushes final input and makes exactly one request', async () => {
  const runtime = create();
  const request = vi.fn(async () => response(runtime));
  const connect = vi.fn(async () => connection(request));
  runtime.ingestSegment({ id: 'one', sourceId: 'mic', text: 'I will email Sam tomorrow.' });
  expect(request).not.toHaveBeenCalled();
  await runtime.extract(connect);
  expect(connect).toHaveBeenCalledOnce();
  expect(request).toHaveBeenCalledOnce();
  expect(runtime.state$.get().result!.items[0]!.text).toBe('Email Sam');
  turn(runtime, 'Another thought.');
  expect(request).toHaveBeenCalledOnce();
  expect(runtime.state$.get().stale).toBe(true);
});

test('rules changes, clear and close abort model work and discard late responses', async () => {
  for (const change of ['rules', 'clear', 'close'] as const) {
    const runtime = create();
    turn(runtime);
    let finish!: (response: unknown) => void;
    let signal!: AbortSignal;
    const validResponse = response(runtime);
    const job = runtime.extract(async () =>
      connection(input => {
        signal = input.signal;
        return new Promise(resolve => {
          finish = resolve;
        });
      })
    );
    await Promise.resolve();
    if (change === 'rules')
      runtime.setRules([{ ...runtime.state$.get().rules[0]!, instructions: 'Only launch tasks' }]);
    else runtime[change]();
    expect(signal.aborted).toBe(true);
    finish(validResponse);
    await job;
    expect(runtime.events$.getAll().some(event => event.type === 'extracted')).toBe(false);
  }
});

test('cancellation during admission prevents even sending a late connection request', async () => {
  const runtime = create();
  turn(runtime);
  let finish!: (value: ExtractionConnection) => void;
  let signal!: AbortSignal;
  const request = vi.fn(async () => response(runtime));
  const connect: ExtractionConnect = input => {
    signal = input.signal;
    return new Promise(resolve => {
      finish = resolve;
    });
  };
  const job = runtime.extract(connect);
  runtime.cancel(true);
  expect(signal.aborted).toBe(true);
  finish(connection(request));
  await job;
  expect(request).not.toHaveBeenCalled();
});

test('new speech cancels an in-flight extraction and discards its outdated response', async () => {
  const runtime = create();
  runtime.loadSample();
  const before = runtime.state$.get().result;
  let finish!: (value: unknown) => void;
  let signal!: AbortSignal;
  const job = runtime.extract(async () =>
    connection(input => {
      signal = input.signal;
      return new Promise(resolve => {
        finish = resolve;
      });
    })
  );
  await Promise.resolve();
  runtime.ingestSegment({ id: 'new', sourceId: 'mic', text: 'A new decision was made.' });
  expect(signal.aborted).toBe(true);
  finish(response(runtime, 'Outdated extraction'));
  await job;
  expect(runtime.state$.get().result).toBe(before);
});

test('provisional speech invalidates pending model work before finalization', async () => {
  const runtime = create();
  turn(runtime);
  let finish!: (value: unknown) => void;
  let signal!: AbortSignal;
  const job = runtime.extract(async () =>
    connection(input => {
      signal = input.signal;
      return new Promise(resolve => {
        finish = resolve;
      });
    })
  );
  await Promise.resolve();
  runtime.updateProvisional('A new thought');
  expect(signal.aborted).toBe(true);
  finish(response(runtime));
  await job;
  expect(runtime.state$.get().result).toBeUndefined();
});

test('replay restores rules, sources, edits and removal without allocating IDs or making model requests', () => {
  const runtime = create();
  runtime.loadSample();
  const id = runtime.state$.get().result!.items[0]!.id;
  runtime.edit(id, 'Email Sam with the revised proposal');
  runtime.setHidden(id, true);
  const events = JSON.parse(JSON.stringify(runtime.events$.getAll()));
  const random = vi.spyOn(crypto, 'randomUUID');
  const replay = createListExtractionDemo({ initialEvents: events });
  runtimes.push(replay);
  expect(random).not.toHaveBeenCalled();
  random.mockRestore();
  expect(replay.state$.get().result).toEqual(runtime.state$.get().result);
  replay.setHidden(id, false);
  expect(replay.state$.get().markdown).toContain('Email Sam with the revised proposal');
  expect(replay.state$.get().markdown).toContain('Source: [00:04]');
});

test('terminal allowance failure survives clear, sample refresh, setup changes and new speech', async () => {
  const runtime = create();
  turn(runtime);
  const request = vi.fn(async () => {
    throw new ExtractionError('Allowance exhausted.', { terminal: true });
  });
  const connect = vi.fn(async () => connection(request));
  await runtime.extract(connect);
  runtime.clear();
  runtime.loadSample();
  runtime.setRules([{ ...runtime.state$.get().rules[0]!, instructions: 'Only launch' }]);
  await runtime.extract(connect);
  turn(runtime);
  await runtime.extract(connect);
  expect(request).toHaveBeenCalledOnce();
  expect(connect).toHaveBeenCalledOnce();
  expect(runtime.state$.get().request.error!.policy.terminal).toBe(true);
});

test('bad output preserves last reviewed results and failure diagnostics cannot leave extraction busy', async () => {
  const runtime = create();
  runtime.loadSample();
  const before = runtime.state$.get().result;
  await runtime.extract(async () => ({
    ...connection(async () => ({})),
    reportFailure: () => {
      throw new Error('diagnostic failure');
    },
  }));
  expect(runtime.state$.get().result).toBe(before);
  expect(runtime.state$.get().request.phase).toBe('idle');
  expect(runtime.state$.get().request.error!.policy.code).toBe('response_format');
});

test('sample never overwrites real speech; refresh respects custom instructions and does not call a model', () => {
  const runtime = create();
  turn(runtime, 'Private speech');
  runtime.loadSample();
  expect(runtime.state$.get().turns).toHaveLength(1);
  expect(runtime.state$.get().result).toBeUndefined();
  runtime.clear();
  runtime.setRules([{ ...runtime.state$.get().rules[0]!, instructions: 'Custom restriction' }]);
  runtime.loadSample();
  expect(runtime.state$.get().result!.items).toEqual([]);
});

test('reviewing an item cancels a pending replacement; concurrent extraction is single-flight', async () => {
  const runtime = create();
  runtime.loadSample();
  let finish!: (value: unknown) => void;
  const request = vi.fn(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const connect = vi.fn(async () => connection(request));
  const late = response(runtime, 'Stale replacement');
  const job = runtime.extract(connect);
  await Promise.resolve();
  await runtime.extract(connect);
  const id = runtime.state$.get().result!.items[0]!.id;
  runtime.edit(id, 'Reviewed wording');
  finish(late);
  await job;
  expect(runtime.state$.get().result!.items[0]!.text).toBe('Reviewed wording');
  expect(connect).toHaveBeenCalledOnce();
});

test('visit close completes content and transient projections and cancels ingestion timers', () => {
  vi.useFakeTimers();
  const runtime = create();
  const complete = vi.fn();
  runtime.state$.subscribe({ complete });
  runtime.ingestSegment({ id: 'one', sourceId: 'mic', text: 'Pending speech.' });
  expect(vi.getTimerCount()).toBe(1);
  runtime.close();
  expect(complete).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

test('restored pending segments retain identity without replay timers or duplicate events', () => {
  vi.useFakeTimers();
  const live = create();
  const first = { id: 'first', sourceId: 'mic', speaker: 'Sam', text: 'We should', startMs: 10 };
  live.ingestSegment(first);
  live.updateProvisional('transient hypothesis');
  const history = JSON.parse(JSON.stringify(live.events$.getAll()));
  const pending = live.state$.get().current;
  live.close();
  const replay = create(history);
  expect(replay.state$.get().current).toEqual(pending);
  expect(replay.state$.get().provisional).toBeUndefined();
  expect(replay.events$.getAll()).toEqual(history);
  expect(vi.getTimerCount()).toBe(0);
  replay.ingestSegment(first);
  expect(replay.events$.getAll()).toEqual(history);
  replay.ingestSegment({
    id: 'second',
    sourceId: 'mic',
    speaker: 'Sam',
    text: 'email Sam.',
    endMs: 50,
  });
  replay.flush();
  expect(replay.state$.get().turns).toEqual([
    { ...pending, text: 'We should email Sam.', endMs: 50 },
  ]);
  const restored = create(JSON.parse(JSON.stringify(replay.events$.getAll())));
  expect(restored.state$.get()).toEqual(replay.state$.get());
  restored.ingestSegment(first);
  restored.flush();
  expect(restored.events$.getAll()).toEqual(replay.events$.getAll());
});

test('clear discards pending input once, retains rules and allows segment IDs in a new session', () => {
  vi.useFakeTimers();
  const live = create();
  live.loadSample();
  live.setRules([{ ...live.state$.get().rules[0]!, name: 'My actions' }]);
  const segment = { id: 'one', sourceId: 'mic', text: 'A fresh commitment.' };
  live.ingestSegment(segment);
  live.updateProvisional('discard this');
  live.clear();
  expect(live.events$.getAll().filter(event => event.type === 'sessionCleared')).toHaveLength(1);
  expect(live.state$.get()).toMatchObject({
    turns: [],
    current: undefined,
    provisional: undefined,
  });
  expect(live.state$.get().result).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
  const replay = create(JSON.parse(JSON.stringify(live.events$.getAll())));
  expect(replay.state$.get()).toEqual(live.state$.get());
  for (const runtime of [live, replay]) {
    runtime.ingestSegment(segment);
    runtime.flush();
  }
  expect(replay.state$.get()).toEqual(live.state$.get());
  expect(replay.events$.getAll()).toEqual(live.events$.getAll());
  expect(replay.state$.get().turns).toHaveLength(1);
  expect(replay.state$.get().rules[0]!.name).toBe('My actions');
});

test('duplicate recorded turns are projected once and legacy history continues on a new source', () => {
  const turn = { id: 'recorded-id', sourceId: 'old', text: 'Original speech', speaker: 'Sam' };
  const history = [
    { type: 'transcriptTurn', turn },
    { type: 'transcriptTurn', turn },
  ];
  const replay = create(history);
  expect(replay.state$.get().turns).toEqual([turn]);
  expect(replay.events$.getAll()).toEqual(history);
  replay.ingestSegment({ id: 'new', sourceId: 'other', text: 'New speech' });
  replay.flush();
  expect(replay.state$.get().turns.map(turn => turn.id)).toEqual(['recorded-id', 'other\0new']);
});

test('restored results remain equivalent through explicit extraction and cancellation', async () => {
  const live = create();
  turn(live);
  await live.extract(async () => connection(async () => response(live)));
  const id = live.state$.get().result!.items[0]!.id;
  live.edit(id, 'Reviewed');
  live.setHidden(id, true);
  const history = JSON.parse(JSON.stringify(live.events$.getAll()));
  const replay = create(history);
  expect(replay.state$.get()).toEqual(live.state$.get());
  let finish!: (value: unknown) => void;
  const request = vi.fn(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const job = replay.extract(async () => connection(request));
  await Promise.resolve();
  replay.cancel(true); // Host source/model changes invalidate even a transport ignoring abort.
  finish(response(replay));
  await job;
  expect(replay.events$.getAll()).toEqual(history);
  expect(replay.state$.get()).toEqual(live.state$.get());
  expect(request).toHaveBeenCalledOnce();
});

test('restored history is validated before any ingestion resources start', () => {
  vi.useFakeTimers();
  expect(() =>
    create([{ type: 'transcriptSegment', segment: { id: 'one', text: 'missing source' } }])
  ).toThrow(/Invalid/);
  expect(() => create([{ type: 'visibilityChanged', id: 'item', hidden: 'yes' }])).toThrow(
    /Invalid/
  );
  expect(() => create({ events: [] })).toThrow(/Invalid/);
  expect(vi.getTimerCount()).toBe(0);
});

test('live and restored pending turns have identical source and speaker boundaries', () => {
  vi.useFakeTimers();
  const live = create();
  live.ingestSegment({ id: 'one', sourceId: 'mic', speaker: 'Sam', text: 'First source.' });
  const replay = create(JSON.parse(JSON.stringify(live.events$.getAll())));
  for (const runtime of [live, replay]) {
    runtime.ingestSegment({ id: 'two', sourceId: 'mic', speaker: 'Lee', text: 'Second speaker.' });
    runtime.ingestSegment({ id: 'one', sourceId: 'other', speaker: 'Lee', text: 'Second source.' });
    runtime.flush();
  }
  expect(replay.events$.getAll()).toEqual(live.events$.getAll());
  expect(replay.state$.get()).toEqual(live.state$.get());
  expect(replay.state$.get().turns.map(turn => turn.id)).toEqual([
    'mic\0one',
    'mic\0two',
    'other\0one',
  ]);
});

test('closing hydrated history does not write; repeated close and flush are inert', () => {
  vi.useFakeTimers();
  const history = [
    {
      type: 'transcriptSegment',
      segment: { id: 'pending', sourceId: 'mic', text: 'Unfinished turn' },
    },
  ];
  const replay = create(history);
  replay.close();
  replay.close();
  replay.flush();
  replay.ingestSegment({ id: 'late', sourceId: 'mic', text: 'Too late' });
  expect(replay.events$.getAll()).toEqual(history);
  expect(vi.getTimerCount()).toBe(0);
});

test('flush never emits a completed turn that is still displayed as pending', () => {
  const runtime = create();
  const duplicates: string[] = [];
  const subscription = runtime.state$.subscribe(state => {
    if (state.current && state.turns.some(turn => turn.id === state.current!.id))
      duplicates.push(state.current.id);
  });
  runtime.ingestSegment({ id: 'one', sourceId: 'mic', text: 'A commitment.' });
  runtime.flush();
  subscription.unsubscribe();
  expect(duplicates).toEqual([]);
  expect(runtime.state$.get().turns).toHaveLength(1);
});

test('segment-only history uses the canonical transcript projection for extraction sources', async () => {
  const history = [
    { type: 'transcriptSegment', segment: { id: 'one', sourceId: 'first', text: 'First source.' } },
    {
      type: 'transcriptSegment',
      segment: { id: 'two', sourceId: 'second', text: 'Second source.' },
    },
  ];
  const replay = create(history);
  expect(replay.state$.get().turns.map(turn => turn.text)).toEqual(['First source.']);
  expect(replay.state$.get().current?.text).toBe('Second source.');
  expect(replay.events$.getAll()).toEqual(history);
  const request = vi.fn<ExtractionConnection['requestCompletion']>(async () => ({
    choices: [{ finish_reason: 'stop', message: { content: '{"items":[]}' } }],
  }));
  await replay.extract(async () => connection(request));
  const body = JSON.parse(request.mock.calls[0]![0].body);
  const input = JSON.parse(body.messages[1].content);
  expect(input.transcript.map((turn: { id: string }) => turn.id)).toEqual([
    'first\0one',
    'second\0two',
  ]);
  expect(replay.state$.get().result!.turnIds).toEqual(['first\0one', 'second\0two']);
});

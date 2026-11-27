import { afterEach, expect, test, vi } from 'vitest';
import {
  createListExtractionDemo,
  type ListExtractionRuntime,
} from '../src/createListExtractionDemo';
import {
  ExtractionError,
  type ExtractionConnect,
  type ExtractionConnection,
} from '../src/extractionModel';

const runtimes: ListExtractionRuntime[] = [];
const create = () => {
  const runtime = createListExtractionDemo();
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
  expect(replay.events$.getAll()).toEqual(runtime.events$.getAll());
  expect(replay.state$.get().result).toEqual(runtime.state$.get().result);
  expect(replay.state$.get().turns).toEqual(runtime.state$.get().turns);
  expect(replay.state$.get().rules).toEqual(runtime.state$.get().rules);
  expect(replay.state$.get().markdown).toBe(runtime.state$.get().markdown);
  expect(replay.state$.get().request.phase).toBe('idle');
  replay.setHidden(id, false);
  expect(replay.state$.get().markdown).toContain('Email Sam with the revised proposal');
  expect(replay.state$.get().markdown).toContain('Source: [00:04]');
});

test('restored history rejects malformed metadata, missing events, and invalid payloads', () => {
  const runtime = create();
  runtime.loadSample();
  const history = JSON.parse(JSON.stringify(runtime.events$.getAll()));
  const invalid = [
    [{ ...history[0], meta: { ...history[0].meta, seq: 1 } }, ...history.slice(1)],
    [history[0], ...history.slice(2)],
    [{ ...history[0], turn: { ...history[0].turn, text: 42 } }, ...history.slice(1)],
    [{ ...history[0], meta: { ...history[0].meta, timestamp: 'not-a-date' } }, ...history.slice(1)],
  ];
  for (const initialEvents of invalid)
    expect(() => createListExtractionDemo({ initialEvents })).toThrow(/./);
  expect(runtime.events$.getAll()).toHaveLength(history.length);
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

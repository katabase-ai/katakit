import { afterEach, expect, test, vi } from 'vitest';
import { createBrainstormDemo } from './createBrainstormDemo';
import { BrainstormRequestError, type BrainstormConnection } from './brainstormModel';
import { challengeCategories, challenges, drawChallenge } from './challenges';

const completion = (text: string, evidence = text) => ({
  choices: [
    {
      finish_reason: 'stop',
      message: { content: JSON.stringify({ answers: [{ text, evidence }] }) },
    },
  ],
});
const connection = (
  requestCompletion: BrainstormConnection['requestCompletion']
): BrainstormConnection => ({
  model: 'test-model',
  maxBodyBytes: 16384,
  maxOutputTokens: 1024,
  requestCompletion,
});
const games: ReturnType<typeof createBrainstormDemo>[] = [];
const game = () => {
  const runtime = createBrainstormDemo();
  games.push(runtime);
  runtime.connect(
    connection(async () => ({
      choices: [{ finish_reason: 'stop', message: { content: '{"answers":[]}' } }],
    }))
  );
  return runtime;
};
const hear = (runtime: ReturnType<typeof createBrainstormDemo>, text: string) =>
  runtime.ingestSegment({ id: crypto.randomUUID(), sourceId: 'test-mic', text });
afterEach(() => {
  games.forEach(runtime => runtime.close());
  games.length = 0;
  vi.useRealTimers();
});

test('the complete library has twenty categories, ten challenges each, and unique prompts and IDs', () => {
  expect(challengeCategories).toHaveLength(20);
  expect(challengeCategories.every(category => category.challenges.length === 10)).toBe(true);
  expect(challenges).toHaveLength(200);
  expect(new Set(challenges.map(challenge => challenge.id)).size).toBe(200);
  expect(new Set(challenges.map(challenge => challenge.prompt)).size).toBe(200);
  expect(
    challenges.every(
      challenge => challenge.judgingRule.trim() && challenge.sampleAnswers.length === 5
    )
  ).toBe(true);
  expect(drawChallenge('animals', 'animals-01', () => 0).id).toBe('animals-02');
  expect(drawChallenge('', 'animals-01', () => 0.999).id).not.toBe('animals-01');
});

test('the sixty-second clock begins only on explicit start, then drains final speech before sealing input', async () => {
  vi.useFakeTimers();
  const runtime = game();
  runtime.connect(connection(async () => completion('dolphin')));
  vi.advanceTimersByTime(90_000);
  expect(runtime.state$.value.phase).toBe('idle');
  expect(runtime.state$.value.remaining).toBe(60);
  runtime.begin();
  vi.advanceTimersByTime(59_000);
  expect(runtime.state$.value.remaining).toBe(1);
  vi.advanceTimersByTime(1000);
  expect(runtime.state$.value.phase).toBe('finishing');
  expect(runtime.state$.value.remaining).toBe(0);
  runtime.ingestSegment({ id: 'drain', sourceId: 'mic', text: 'dolphin' });
  runtime.flush();
  runtime.ingestSegment({ id: 'late', sourceId: 'mic', text: 'octopus' });
  await Promise.resolve();
  expect(runtime.state$.value.phase).toBe('finished');
  expect(runtime.state$.value.notes.map(note => note.text)).toEqual(['dolphin']);
  expect(vi.getTimerCount()).toBe(0);
});

test('untimed rounds remain open until ended, and interim speech is never scored', () => {
  vi.useFakeTimers();
  const runtime = game();
  runtime.configure({ seconds: null });
  runtime.begin();
  vi.advanceTimersByTime(600_000);
  runtime.updateProvisional('octopus');
  expect(runtime.state$.value.phase).toBe('running');
  expect(runtime.state$.value.remaining).toBeNull();
  expect(runtime.state$.value.notes).toEqual([]);
  runtime.finish();
  runtime.flush();
  expect(runtime.state$.value.provisional).toBe('');
});

test('validated model answers are deduplicated and empty judgments still advance the cursor', async () => {
  const runtime = game();
  const batch = {
    choices: [
      {
        finish_reason: 'stop',
        message: {
          content: JSON.stringify({
            answers: [
              { text: 'Octopus', evidence: 'Octopus' },
              { text: 'dolphin', evidence: 'dolphin' },
            ],
          }),
        },
      },
    ],
  };
  runtime.connect(
    connection(
      vi
        .fn()
        .mockResolvedValueOnce(batch)
        .mockResolvedValueOnce(completion('dolphin', 'dolphins'))
        .mockResolvedValueOnce({
          choices: [{ finish_reason: 'stop', message: { content: '{"answers":[]}' } }],
        })
    )
  );
  runtime.begin();
  hear(runtime, 'Octopus, dolphin, bicycle.');
  await vi.waitFor(() => expect(runtime.state$.value.cursor).toBe(1));
  hear(runtime, 'dolphins and octopus');
  await vi.waitFor(() => expect(runtime.state$.value.cursor).toBe(2));
  hear(runtime, 'not a jellyfish');
  await vi.waitFor(() => expect(runtime.state$.value.cursor).toBe(3));
  expect(runtime.state$.value.notes.map(note => note.text)).toEqual(['Octopus', 'dolphin']);
  expect(runtime.state$.value.cursor).toBe(3);
});

test('repeated final segment delivery is idempotent and removed notes stay removed', async () => {
  const runtime = game();
  runtime.connect(connection(async () => completion('dolphin')));
  runtime.begin();
  const segment = { id: 'one', sourceId: 'mic', text: 'dolphin' };
  runtime.ingestSegment(segment);
  runtime.ingestSegment(segment);
  await vi.waitFor(() => expect(runtime.state$.value.notes).toHaveLength(1));
  const id = runtime.state$.value.notes[0]!.id;
  runtime.remove(id);
  hear(runtime, 'dolphin');
  await vi.waitFor(() => expect(runtime.state$.value.cursor).toBe(2));
  expect(runtime.state$.value.segments).toHaveLength(2);
  expect(runtime.state$.value.notes).toEqual([]);
  expect(runtime.state$.value.removed).toEqual(['dolphin']);
});

test('live judging accepts valid non-example answers and retains arrivals during a single-flight request', async () => {
  const runtime = game();
  let complete!: (value: unknown) => void;
  const request = vi
    .fn<BrainstormConnection['requestCompletion']>()
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          complete = resolve;
        })
    )
    .mockResolvedValueOnce(completion('Orca', 'orca'));
  runtime.connect(connection(request));
  runtime.begin();
  hear(runtime, 'seal');
  hear(runtime, 'orca');
  expect(request).toHaveBeenCalledTimes(1);
  complete(completion('Seal', 'seal'));
  await vi.waitFor(() => expect(runtime.state$.value.cursor).toBe(2));
  expect(request).toHaveBeenCalledTimes(2);
  expect(runtime.state$.value.notes.map(note => note.text)).toEqual(['Seal', 'Orca']);
  const body = JSON.parse(request.mock.calls[1]![0].body);
  const context = JSON.parse(body.messages[1].content);
  expect(context.existing).toEqual(['Seal']);
  expect(context.newTranscript).toBe('orca');
});

test('a finished round waits for pending judging before starting the next one', async () => {
  const runtime = game();
  let complete!: (value: unknown) => void;
  runtime.connect(
    connection(
      () =>
        new Promise(resolve => {
          complete = resolve;
        })
    )
  );
  runtime.begin();
  hear(runtime, 'seal');
  runtime.finish();
  runtime.flush();
  expect(runtime.state$.value.busy).toBe(true);
  runtime.begin();
  expect(runtime.state$.value.phase).toBe('finished');
  complete(completion('Seal', 'seal'));
  await vi.waitFor(() => expect(runtime.state$.value.busy).toBe(false));
  expect(runtime.state$.value.notes.map(note => note.text)).toEqual(['Seal']);
  runtime.begin();
  expect(runtime.state$.value.phase).toBe('running');
});

test('long finalized utterances preserve answers across character boundaries', async () => {
  const runtime = game();
  const request = vi
    .fn<BrainstormConnection['requestCompletion']>()
    .mockResolvedValue(completion('Hammerhead shark', 'hammerhead shark'));
  runtime.connect(connection(request));
  runtime.begin();
  const text = `${'um '.repeat(332)}hammerhead shark`;
  runtime.ingestSegment({ id: 'long', sourceId: 'mic', text });
  await vi.waitFor(() => expect(runtime.state$.value.notes).toHaveLength(1));
  const body = JSON.parse(request.mock.calls[0]![0].body);
  expect(JSON.parse(body.messages[1].content).newTranscript).toBe(text);
  expect(runtime.state$.value.segments).toHaveLength(1);
});

test('a malformed batch pauses without advancing its cursor and explicit retry processes every pending segment', async () => {
  const runtime = game();
  const request = vi
    .fn<BrainstormConnection['requestCompletion']>()
    .mockResolvedValueOnce(completion('Seal', 'not in the transcript'))
    .mockResolvedValueOnce(completion('Seal', 'seal'));
  runtime.connect(connection(request));
  runtime.begin();
  hear(runtime, 'seal');
  await vi.waitFor(() => expect(runtime.state$.value.failure).toBeDefined());
  hear(runtime, 'not a bicycle');
  expect(runtime.state$.value.cursor).toBe(0);
  expect(request).toHaveBeenCalledTimes(1);
  runtime.retry();
  await vi.waitFor(() => expect(runtime.state$.value.cursor).toBe(2));
  expect(runtime.state$.value.notes.map(note => note.text)).toEqual(['Seal']);
});

test('an old response cannot change a new round, even if transport ignores cancellation', async () => {
  const runtime = game();
  let complete!: (value: unknown) => void;
  let signal!: AbortSignal;
  runtime.connect(
    connection(async input => {
      signal = input.signal;
      return new Promise(resolve => {
        complete = resolve;
      });
    })
  );
  runtime.begin();
  hear(runtime, 'seal');
  runtime.finish();
  runtime.flush();
  runtime.configure({ challengeId: 'animals-02' });
  runtime.begin();
  expect(signal.aborted).toBe(true);
  complete(completion('Seal', 'seal'));
  await Promise.resolve();
  expect(runtime.state$.value.challengeId).toBe('animals-02');
  expect(runtime.state$.value.notes).toEqual([]);
  expect(runtime.state$.value.cursor).toBe(0);
});

test('removal while a request is in flight cannot be undone by its stale result', async () => {
  const runtime = game();
  let complete!: (value: unknown) => void;
  const request = vi
    .fn<BrainstormConnection['requestCompletion']>()
    .mockResolvedValueOnce(completion('Seal', 'seal'))
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          complete = resolve;
        })
    );
  runtime.connect(connection(request));
  runtime.begin();
  hear(runtime, 'seal');
  await vi.waitFor(() => expect(runtime.state$.value.notes).toHaveLength(1));
  hear(runtime, 'seal again');
  runtime.remove(runtime.state$.value.notes[0]!.id);
  complete(completion('Seal', 'seal'));
  await vi.waitFor(() => expect(runtime.state$.value.cursor).toBe(2));
  expect(runtime.state$.value.notes).toEqual([]);
});

test('request sizing failure retains input and terminal host failures survive new rounds', async () => {
  const runtime = game();
  const request = vi.fn<BrainstormConnection['requestCompletion']>();
  runtime.connect({ ...connection(request), maxBodyBytes: 10 });
  runtime.begin();
  hear(runtime, 'seal');
  await vi.waitFor(() => expect(runtime.state$.value.failure?.policy.code).toBe('context_limit'));
  expect(request).not.toHaveBeenCalled();
  expect(runtime.state$.value.cursor).toBe(0);
  runtime.finish();
  runtime.flush();
  runtime.configure({});
  expect(runtime.state$.value.failure).toBeUndefined();
  runtime.connect(
    connection(async () => {
      throw new BrainstormRequestError('Allowance exhausted', { terminal: true, code: 'quota' });
    })
  );
  runtime.begin();
  hear(runtime, 'seal');
  await vi.waitFor(() => expect(runtime.state$.value.failure?.policy.code).toBe('quota'));
  runtime.finish();
  runtime.flush();
  runtime.configure({});
  runtime.begin();
  expect(runtime.state$.value.phase).toBe('idle');
  expect(runtime.state$.value.failure?.message).toBe('Allowance exhausted');
});

test('a manually ended clock stays frozen', () => {
  vi.useFakeTimers();
  const runtime = game();
  runtime.begin();
  vi.advanceTimersByTime(10_000);
  runtime.finish();
  runtime.flush();
  vi.advanceTimersByTime(10_000);
  runtime.remove('absent');
  expect(runtime.state$.value.remaining).toBe(50);
});

test('a judging connection is required and finalized speech cannot start a round', () => {
  const runtime = createBrainstormDemo();
  games.push(runtime);
  runtime.begin();
  hear(runtime, 'dolphin');
  expect(runtime.state$.value.phase).toBe('idle');
  expect(runtime.state$.value.deadline).toBeNull();
  expect(runtime.state$.value.segments).toEqual([]);
  expect(runtime).not.toHaveProperty('submitText');
  expect(runtime).not.toHaveProperty('setPractice');
  expect(runtime.state$.value).not.toHaveProperty('practice');
});

test('close aborts work, completes the public state, and clears every timer', async () => {
  vi.useFakeTimers();
  const runtime = game();
  let complete!: (value: unknown) => void;
  let signal!: AbortSignal;
  const completed = vi.fn();
  runtime.state$.subscribe({ complete: completed });
  runtime.connect(
    connection(input => {
      signal = input.signal;
      return new Promise(resolve => {
        complete = resolve;
      });
    })
  );
  runtime.begin();
  hear(runtime, 'seal');
  runtime.close();
  expect(signal.aborted).toBe(true);
  expect(completed).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  complete(completion('Seal', 'seal'));
  await Promise.resolve();
  expect(runtime.state$.value.notes).toEqual([]);
});

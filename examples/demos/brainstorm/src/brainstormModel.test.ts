import { expect, test, vi } from 'vitest';
import { findChallenge } from './challenges';
import {
  judgeBrainstormCandidates,
  requestBrainstormModel,
  BrainstormRequestError,
  type BrainstormConnection,
} from './brainstormModel';

const candidates = Array.from({ length: 20 }, (_, i) => ({
  text: `garment ${i}`,
  evidence: `garment ${i}`,
}));
const judge = (input: Partial<Pick<BrainstormConnection, 'maxBodyBytes'>> = {}) => ({
  challenge: findChallenge('clothing-and-accessories-04'),
  candidates,
  text: candidates.map(candidate => candidate.text).join(', '),
  connection: {
    model: 'extractor',
    maxBodyBytes: 16384,
    maxOutputTokens: 1024,
    requestCompletion: vi.fn(),
    decisions: {
      model: 'typesafe/jev-1.13',
      maxQuestions: 16,
      requestDecision: vi.fn(async ({ body }: { body: string }) => ({
        answers: Object.fromEntries(
          Object.keys(JSON.parse(body).questions).map(key => [key, { type: 'noul', noul: 0.9 }])
        ),
      })),
    },
    ...input,
  },
  signal: new AbortController().signal,
});

test('decision batches respect question and byte limits while preserving every candidate', async () => {
  const input = judge({ maxBodyBytes: 5000 });
  const result = await judgeBrainstormCandidates(input);
  expect(result.map(candidate => candidate.text)).toEqual(
    candidates.map(candidate => candidate.text)
  );
  expect(input.connection.decisions.requestDecision.mock.calls.length).toBeGreaterThan(1);
  for (const [request] of input.connection.decisions.requestDecision.mock.calls) {
    expect(new TextEncoder().encode(request.body).byteLength).toBeLessThanOrEqual(5000);
    expect(Object.keys(JSON.parse(request.body).questions).length).toBeLessThanOrEqual(16);
  }
});

test('a single oversized decision pauses before making a request rather than dropping a candidate', async () => {
  const input = judge({ maxBodyBytes: 50 });
  await expect(judgeBrainstormCandidates(input)).rejects.toMatchObject({
    policy: { code: 'context_limit', terminal: true },
  });
  expect(input.connection.decisions.requestDecision).not.toHaveBeenCalled();
});

test('empty extraction needs no decision request, and cancellation prevents decision calls', async () => {
  const input = judge();
  expect(await judgeBrainstormCandidates({ ...input, candidates: [] })).toEqual([]);
  const controller = new AbortController();
  controller.abort();
  await expect(
    judgeBrainstormCandidates({ ...input, signal: controller.signal })
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(input.connection.decisions.requestDecision).not.toHaveBeenCalled();
});

test('only transient host failures retry the same request and cancellation clears backoff', async () => {
  vi.useFakeTimers();
  try {
    const request = vi
      .fn<BrainstormConnection['requestCompletion']>()
      .mockRejectedValueOnce(
        new BrainstormRequestError('Busy', { retryLimit: 1, retryAfterMs: 5000 })
      )
      .mockResolvedValueOnce({ answers: {} });
    const controller = new AbortController();
    const input = { body: 'same candidate batch', signal: controller.signal };
    const pending = requestBrainstormModel(request, input);
    await vi.advanceTimersByTimeAsync(4999);
    expect(request).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ answers: {} });
    expect(request.mock.calls).toEqual([[input], [input]]);
    request.mockRejectedValue(
      new BrainstormRequestError('Busy', { retryLimit: 1, retryAfterMs: 5000 })
    );
    const pendingCancellation = requestBrainstormModel(request, input);
    const canceled = (async () => {
      try {
        return await pendingCancellation;
      } catch (error) {
        return error;
      }
    })();
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    expect(await canceled).toMatchObject({ name: 'AbortError' });
    expect(vi.getTimerCount()).toBe(0);
    expect(request).toHaveBeenCalledTimes(3);
  } finally {
    vi.useRealTimers();
  }
});

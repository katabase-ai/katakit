import { expect, test, vi } from 'vitest';
import {
  connectWithKey,
  createGalleryInference,
  defaultInference,
  inferenceStorageKey,
  validateInference,
} from './galleryInference';

const fixture = () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  return { storage, values, owner: createGalleryInference(storage) };
};
const settings = { ...defaultInference, source: 'key' as const, key: 'test-visitor-key' };
const input = (signal = new AbortController().signal) => ({
  signal,
  verification: {} as HTMLElement,
  onAllowance: vi.fn(),
});

test('persists source and overrides across owners, aborts on save/other-tab changes, and removes the key', () => {
  const { owner, storage, values } = fixture();
  const original = owner.getSignal();
  owner.save({
    ...settings,
    model: 'custom/model',
    endpoint: 'http://localhost:8080/v1/chat/completions',
  });
  expect(original.aborted).toBe(true);
  const refreshed = createGalleryInference(storage);
  expect(refreshed.getSnapshot()).toEqual(owner.getSnapshot());
  const active = owner.getSignal();
  refreshed.remove();
  owner.reload();
  expect(active.aborted).toBe(true);
  expect(owner.getSnapshot()).toEqual(defaultInference);
  expect(values.has(inferenceStorageKey)).toBe(false);
});

test('blocked storage reports failure without replacing or forgetting the active configuration', () => {
  const { storage } = fixture();
  const owner = createGalleryInference({
    ...storage,
    setItem: () => {
      throw new Error('private browser detail');
    },
    removeItem: () => {
      throw new Error('private browser detail');
    },
  });
  expect(() => owner.save(settings)).toThrow('Could not save settings in this browser');
  expect(() => owner.remove()).toThrow('Could not remove the saved key');
  expect(owner.getSnapshot()).toEqual(defaultInference);
  expect(owner.getSignal().aborted).toBe(false);
});

test.each([
  'javascript:alert(1)',
  'http://example.com/chat',
  'https://user:secret@example.com/chat',
  'https://example.com/chat?key=secret',
  'https://example.com/chat#secret',
])('rejects insecure or credential-bearing override %s', endpoint => {
  expect(() => validateInference({ ...settings, endpoint })).toThrow(/Use HTTPS/);
});

test('direct transport forwards the complete structured request, without cookies, redirects or host allowance', async () => {
  const result = {
    choices: [{ finish_reason: 'stop', message: { content: '{"additions":[],"rewords":[]}' } }],
  };
  const request = vi.fn<typeof fetch>(async () => Response.json(result));
  const admission = input();
  const connection = await connectWithKey(settings, new AbortController().signal, { request })(
    admission
  );
  const body = JSON.stringify({
    model: connection.model,
    response_format: { type: 'json_schema' },
    messages: [{ role: 'user', content: 'test' }],
  });
  expect(request).not.toHaveBeenCalled();
  await expect(
    connection.requestCompletion({ body, signal: new AbortController().signal })
  ).resolves.toEqual(result);
  expect(request).toHaveBeenCalledWith(
    settings.endpoint,
    expect.objectContaining({
      body,
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-visitor-key' },
    })
  );
  expect(admission.onAllowance).not.toHaveBeenCalled();
});

test('key removal aborts transport and rejects a late response even if fetch ignores cancellation', async () => {
  const { owner } = fixture();
  owner.save(settings);
  let finish!: (response: Response) => void;
  const request = vi.fn<typeof fetch>(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const onTokenUsage = vi.fn();
  const connection = await connectWithKey(owner.getSnapshot(), owner.getSignal(), {
    request,
    onTokenUsage,
  })(input());
  const pending = connection.requestCompletion({
    body: '{}',
    signal: new AbortController().signal,
  });
  const rejected = (async () => {
    try {
      return await pending;
    } catch (error) {
      return error;
    }
  })();
  owner.remove();
  expect(request.mock.calls[0]![1]!.signal!.aborted).toBe(true);
  finish(Response.json({ choices: [], usage: { total_tokens: 100 } }));
  expect(await rejected).toMatchObject({ name: 'AbortError' });
  await expect(
    connection.requestCompletion({ body: '{}', signal: new AbortController().signal })
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(request).toHaveBeenCalledOnce();
  expect(onTokenUsage).not.toHaveBeenCalled();
});

test.each([401, 402, 429, 400, 404, 500])(
  'provider HTTP %s yields an actionable error without echoing its body',
  async status => {
    const request = vi.fn<typeof fetch>(
      async () => new Response('secret-provider-body', { status })
    );
    const onTokenUsage = vi.fn();
    const connection = await connectWithKey(settings, new AbortController().signal, {
      request,
      onTokenUsage,
    })(input());
    const error = await connection
      .requestCompletion({ body: '{}', signal: new AbortController().signal })
      .catch(error => error as Error);
    expect(error).toMatchObject({ name: 'Error', policy: {} });
    expect((error as Error).message).not.toContain('secret');
    expect((error as Error).message).not.toContain(settings.key);
    expect(onTokenUsage).not.toHaveBeenCalled();
  }
);

test.each([
  [{ usage: { total_tokens: 125, prompt_tokens: 100, completion_tokens: 25 } }, 125],
  [{ usage: { total_tokens: 0 } }, 0],
  [{}, undefined],
  [{ usage: { total_tokens: -1 } }, undefined],
  [{ usage: { total_tokens: 1.5 } }, undefined],
  [{ usage: { total_tokens: '125' } }, undefined],
])('reports provider token totals without changing the response: %j', async (result, tokens) => {
  const onTokenUsage = vi.fn();
  const connection = await connectWithKey(settings, new AbortController().signal, {
    request: async () => Response.json(result),
    onTokenUsage,
  })(input());
  expect(onTokenUsage).not.toHaveBeenCalled();
  // Reporting precedes demo validation: a malformed completion still costs tokens on a retry.
  for (let attempt = 0; attempt < 2; attempt++) {
    await expect(
      connection.requestCompletion({ body: '{}', signal: new AbortController().signal })
    ).resolves.toEqual(result);
  }
  expect(onTokenUsage.mock.calls).toEqual([[tokens], [tokens]]);
});

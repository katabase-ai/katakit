// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { BehaviorSubject } from 'rxjs';
import { expect, test, vi } from 'vitest';
import type { createNotesDemo } from '../src/createNotesDemo';
import { NotesRequestError, type NotesConnection } from '../src/notesModel';
import { useNotesConnection } from '../src/useNotesConnection';

test('a restart-policy failure cannot reconnect after listening stops', async () => {
  const state$ = new BehaviorSubject<{ notes: { status: string; failure?: NotesRequestError } }>({
    notes: { status: 'idle' },
  });
  const runtime = {
    state$,
    notes: { pause: vi.fn(), connect: vi.fn(), retry: vi.fn() },
  } as unknown as ReturnType<typeof createNotesDemo>;
  const connect = vi.fn(async (): Promise<NotesConnection> => ({
    model: 'test',
    maxBodyBytes: 1024,
    maxOutputTokens: 128,
    requestCompletion: async () => ({}),
  }));
  const view = renderHook(({ listening }) => useNotesConnection({ runtime, connect, listening }), {
    initialProps: { listening: true },
  });
  await vi.waitFor(() => expect(runtime.notes.connect).toHaveBeenCalledOnce());
  view.rerender({ listening: false });
  act(() => {
    state$.next({
      notes: { status: 'paused', failure: new NotesRequestError('expired', { restart: true }) },
    });
  });
  expect(connect).toHaveBeenCalledTimes(1);
  view.unmount();
  state$.complete();
});

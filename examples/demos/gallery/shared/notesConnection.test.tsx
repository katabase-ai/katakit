// @vitest-environment happy-dom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { NotesDemo } from '../../notes-react/src/NotesDemo';
import { createNotesDemo } from '../../notes-react/src/createNotesDemo';
import {
  createNotesRequest,
  NotesRequestError,
  type NotesConnection,
} from '../../notes-react/src/notesModel';

const completion = (text: string) => ({
  choices: [
    {
      finish_reason: 'stop',
      message: { content: JSON.stringify({ additions: [{ text }], rewords: [] }) },
    },
  ],
});
const connection = (requestCompletion: NotesConnection['requestCompletion']): NotesConnection => ({
  model: 'test/model',
  maxBodyBytes: 65536,
  maxOutputTokens: 1024,
  requestCompletion,
});
const turn = (runtime: ReturnType<typeof createNotesDemo>, text: string) => {
  runtime.ingestSegment({ id: crypto.randomUUID(), sourceId: 'microphone', text });
  runtime.flush();
};
afterEach(cleanup);

test('notes connect only while listening; a source change aborts, preserves content and reconnects', async () => {
  const runtime = createNotesDemo();
  let finish!: (value: unknown) => void;
  let signal!: AbortSignal;
  const firstRequest = vi.fn<NotesConnection['requestCompletion']>(({ signal: requestSignal }) => {
    signal = requestSignal;
    return new Promise((resolve, reject) => {
      finish = resolve;
      requestSignal.addEventListener('abort', () => reject(requestSignal.reason));
    });
  });
  const first = vi.fn(async () => connection(firstRequest));
  const secondRequest = vi.fn<NotesConnection['requestCompletion']>(async () =>
    completion('Accepted note')
  );
  const second = vi.fn(async () => connection(secondRequest));
  const view = render(<NotesDemo runtime={runtime} connect={first} />);
  act(() => turn(runtime, 'Plan the launch.'));
  await act(async () => {});
  expect(first).not.toHaveBeenCalled();
  expect(screen.queryByRole('button')).toBeNull();
  view.rerender(<NotesDemo runtime={runtime} connect={first} listening />);
  await vi.waitFor(() => expect(firstRequest).toHaveBeenCalledOnce());
  view.rerender(<NotesDemo runtime={runtime} connect={second} listening />);
  expect(signal.aborted).toBe(true);
  expect(runtime.state$.get().notes.turns).toHaveLength(1);
  await act(async () => {
    finish(completion('Obsolete note'));
  });
  await vi.waitFor(() => expect(second).toHaveBeenCalledOnce());
  act(() => turn(runtime, 'Keep capture running.'));
  await screen.findByText('Accepted note');
  expect(screen.queryByText('Obsolete note')).toBeNull();
  expect(JSON.parse(secondRequest.mock.calls[0]![0].body).messages[1].content).toContain(
    'Plan the launch.'
  );
  expect(runtime.state$.get().notes.cursor).toBe(2);
  view.unmount();
  runtime.close();
});

test('unmount aborts pending admission and ignores its late connection', async () => {
  const runtime = createNotesDemo();
  let finish!: (value: NotesConnection) => void;
  let signal!: AbortSignal;
  const request = vi.fn(async () => completion('Late note'));
  const connect = vi.fn(({ signal: input }: { signal: AbortSignal }) => {
    signal = input;
    return new Promise<NotesConnection>(resolve => {
      finish = resolve;
    });
  });
  const view = render(<NotesDemo runtime={runtime} connect={connect} listening />);
  act(() => turn(runtime, 'Before unmount.'));
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => {
    finish(connection(request));
  });
  expect(request).not.toHaveBeenCalled();
  runtime.close();
});

test('exhaustion leaves capture usable and clear/new turns cannot restart or restore allowance', async () => {
  const runtime = createNotesDemo();
  const request = vi.fn(async () => {
    throw new NotesRequestError('Free demo allowance used.', { terminal: true });
  });
  const connect = vi.fn(async () => connection(request));
  const view = render(<NotesDemo runtime={runtime} connect={connect} listening />);
  act(() => turn(runtime, 'First thought.'));
  await screen.findByText('Free demo allowance used.');
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  // Nothing to clear is offered while the outline is empty; clearing still cannot restore allowance.
  expect(screen.queryByRole('button', { name: 'Clear notes' })).toBeNull();
  act(() => runtime.notes.clear());
  act(() => turn(runtime, 'Still transcribing.'));
  expect(runtime.state$.get().notes.turns).toHaveLength(2);
  expect(request).toHaveBeenCalledOnce();
  expect(connect).toHaveBeenCalledOnce();
  view.unmount();
  runtime.close();
});

test('a failed admission is retried twice on its own, then again when listening restarts', async () => {
  const runtime = createNotesDemo();
  const request = vi.fn(async () => completion('Verified note'));
  const connect = vi.fn(async () => connection(request));
  const failure = new NotesRequestError('Verification failed.');
  connect
    .mockRejectedValueOnce(failure)
    .mockRejectedValueOnce(failure)
    .mockRejectedValueOnce(failure);
  const view = render(<NotesDemo runtime={runtime} connect={connect} listening />);
  act(() => turn(runtime, 'Retained across verification.'));
  await screen.findByText('Verification failed. Pause and resume to try again.', undefined, {
    timeout: 3000,
  });
  expect(connect).toHaveBeenCalledTimes(3);
  expect(request).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  view.rerender(<NotesDemo runtime={runtime} connect={connect} />);
  view.rerender(<NotesDemo runtime={runtime} connect={connect} listening />);
  await screen.findByText('Verified note');
  expect(connect).toHaveBeenCalledTimes(4);
  view.unmount();
  runtime.close();
});

test('Strict Mode replays effects without leaving a second admission running', async () => {
  const runtime = createNotesDemo();
  const request = vi.fn(async () => completion('Verified note'));
  const connect = vi.fn(async () => connection(request));
  const view = render(
    <StrictMode>
      <NotesDemo runtime={runtime} connect={connect} listening />
    </StrictMode>
  );
  act(() => turn(runtime, 'A thought.'));
  await screen.findByText('Verified note');
  expect(request).toHaveBeenCalledOnce();
  view.unmount();
  runtime.close();
});

test('restart policy admits a new connection on its own rather than retrying the failed session', async () => {
  const runtime = createNotesDemo();
  const stale = vi.fn(async () => {
    throw new NotesRequestError('Session expired.', { restart: true });
  });
  const fresh = vi.fn(async () => completion('Recovered note'));
  const connect = vi.fn(async () => connection(fresh)).mockResolvedValueOnce(connection(stale));
  const view = render(<NotesDemo runtime={runtime} connect={connect} listening />);
  act(() => turn(runtime, 'Keep this thought.'));
  await screen.findByText('Recovered note');
  expect(connect).toHaveBeenCalledTimes(2);
  expect(stale).toHaveBeenCalledOnce();
  expect(fresh).toHaveBeenCalledOnce();
  view.unmount();
  runtime.close();
});

test('Clear notes preserves local turns, skips old thoughts and rejects a late model result through the UI', async () => {
  const runtime = createNotesDemo();
  let finish!: (value: unknown) => void;
  const request = vi
    .fn<NotesConnection['requestCompletion']>()
    .mockResolvedValueOnce(completion('Accepted outline'))
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    )
    .mockResolvedValue(completion('A fresh topic'));
  const connect = vi.fn(async () => connection(request));
  const view = render(<NotesDemo runtime={runtime} connect={connect} listening />);
  act(() => turn(runtime, 'Original thought'));
  await screen.findByText('Accepted outline');
  act(() => turn(runtime, 'Pending thought'));
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  const clear = screen.getByRole('button', { name: 'Clear notes' });
  expect(document.getElementById(clear.getAttribute('aria-describedby')!)?.textContent).toContain(
    'may still be sent as model context'
  );
  fireEvent.click(clear);
  expect(request.mock.calls[1]![0].signal.aborted).toBe(true);
  expect(runtime.state$.get().notes.turns).toHaveLength(2);
  expect(runtime.state$.get().notes.cursor).toBe(2);
  await act(async () => finish(completion('Obsolete outline')));
  expect(screen.queryByText('Obsolete outline')).toBeNull();
  expect(screen.queryByText('Accepted outline')).toBeNull();
  act(() => turn(runtime, 'A fresh topic'));
  await screen.findByText('A fresh topic');
  expect(request).toHaveBeenCalledTimes(3);
  const conversation = JSON.parse(request.mock.calls[2]![0].body).messages[1].content as string;
  expect(conversation).toContain('recentTurns[2]{text}:\n  Original thought\n  Pending thought');
  expect(conversation.split('pendingTurns')[1]).toBe(
    '[1]{text}:\n  A fresh topic\n</conversation>'
  );
  expect(connect).toHaveBeenCalledOnce();
  view.unmount();
  runtime.close();
});

test('stopping and restarting listening reuses the connection', async () => {
  const runtime = createNotesDemo();
  const request = vi.fn(async () => completion('Automatic note'));
  const connect = vi.fn(async () => connection(request));
  const view = render(<NotesDemo runtime={runtime} connect={connect} listening />);
  act(() => turn(runtime, 'Spoken while listening.'));
  await screen.findByText('Automatic note');
  view.rerender(<NotesDemo runtime={runtime} connect={connect} />);
  view.rerender(<NotesDemo runtime={runtime} connect={connect} listening />);
  await act(async () => {});
  expect(connect).toHaveBeenCalledOnce();
  view.unmount();
  runtime.close();
});

test('Clear notes retains the transcript but limits earlier context sent to the model', () => {
  const runtime = createNotesDemo();
  for (let index = 0; index < 8; index++) turn(runtime, `Thought ${index}`);
  runtime.notes.clear();
  turn(runtime, 'New thought');
  const { notes, turns } = runtime.state$.get();
  const { cursor } = notes;
  expect(turns).toHaveLength(9);
  expect(cursor).toBe(8);
  const request = createNotesRequest({
    notes: notes.notes,
    turns,
    cursor,
    connection: connection(vi.fn()),
  });
  const conversation = JSON.parse(request.body).messages[1].content as string;
  expect(conversation).not.toContain('Thought 0');
  expect(conversation).not.toContain('Thought 1');
  expect(conversation).toContain('Thought 2');
  expect(conversation).toContain('New thought');
  runtime.close();
});

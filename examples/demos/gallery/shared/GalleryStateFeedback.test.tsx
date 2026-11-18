// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { NotesDemo } from '../../notes-react/src/NotesDemo';
import { createNotesDemo } from '../../notes-react/src/createNotesDemo';
import type { NotesConnection } from '../../notes-react/src/notesModel';
import { BrowserBingoDemo } from '../../bingo-react/src/BrowserBingoDemo';
import { createBrowserBingoDemo } from '../../bingo-react/src/createBrowserBingoDemo';

afterEach(cleanup);

test('Notes announces connection, pending work and explicit pause without resuming on new speech', async () => {
  const runtime = createNotesDemo();
  let admit!: (connection: NotesConnection) => void;
  const connect = vi.fn(
    () =>
      new Promise<NotesConnection>(resolve => {
        admit = resolve;
      })
  );
  let signal!: AbortSignal;
  const requestCompletion = vi.fn<NotesConnection['requestCompletion']>(({ signal: current }) => {
    signal = current;
    return new Promise(() => {});
  });
  const view = render(<NotesDemo runtime={runtime} connect={connect} />);
  const status = screen.getByRole('status');
  const start = screen.getByRole('button', { name: 'Start notes' });
  expect(status.textContent).toContain('Notes are off');
  expect(start.getAttribute('aria-describedby')).toBe(status.id);
  fireEvent.click(start);
  expect(status.textContent).toContain('Connecting notes');
  await act(async () =>
    admit({ model: 'test/model', maxBodyBytes: 65536, maxOutputTokens: 1024, requestCompletion })
  );
  expect(status.textContent).toContain('Notes are on');
  act(() => {
    runtime.ingestSegment({ id: 'one', sourceId: 'microphone', text: 'A first thought' });
    runtime.flush();
  });
  await vi.waitFor(() => expect(requestCompletion).toHaveBeenCalledOnce());
  expect(status.textContent).toContain('Updating notes');
  fireEvent.click(screen.getByRole('button', { name: 'Pause notes' }));
  expect(signal.aborted).toBe(true);
  expect(status.textContent).toContain('Notes paused');
  act(() => {
    runtime.ingestSegment({ id: 'two', sourceId: 'microphone', text: 'A later thought' });
    runtime.flush();
  });
  await act(async () => {});
  expect(status.textContent).toContain('Notes paused');
  expect(requestCompletion).toHaveBeenCalledOnce();
  expect(connect).toHaveBeenCalledOnce();
  view.unmount();
  runtime.close();
});

test('a disabled Notes start is described by the unavailable-connection explanation', () => {
  const runtime = createNotesDemo();
  const view = render(<NotesDemo runtime={runtime} />);
  const start = screen.getByRole('button', { name: 'Start notes' }) as HTMLButtonElement;
  expect(start.disabled).toBe(true);
  expect(document.getElementById(start.getAttribute('aria-describedby')!)?.textContent).toContain(
    'No model connection'
  );
  view.unmount();
  runtime.close();
});

test('Bingo announces matched-square counts and completed lines as one polite status', () => {
  const runtime = createBrowserBingoDemo();
  const view = render(<BrowserBingoDemo runtime={runtime} />);
  const status = screen.getByRole('status');
  expect(status.getAttribute('aria-atomic')).toBe('true');
  expect(status.textContent).toContain('0 of 24 squares');
  act(() => {
    runtime.ingestSegment({ id: 'one', sourceId: 'microphone', text: 'Quick question' });
    runtime.flush();
  });
  expect(status.textContent).toContain('1 of 24 squares');
  act(() => {
    for (let index = 1; index < 5; index++) runtime.bingoMethods.setOverride(index, true);
  });
  expect(status.textContent).toContain('Bingo!');
  expect(status.textContent).toContain('1 line complete');
  view.unmount();
  runtime.close();
});

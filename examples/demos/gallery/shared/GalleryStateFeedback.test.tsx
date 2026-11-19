// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { NotesDemo } from '../../notes-react/src/NotesDemo';
import { createNotesDemo } from '../../notes-react/src/createNotesDemo';
import type { NotesConnection } from '../../notes-react/src/notesModel';
import { BrowserBingoDemo } from '../../bingo-react/src/BrowserBingoDemo';
import { createBrowserBingoDemo } from '../../bingo-react/src/createBrowserBingoDemo';

afterEach(cleanup);

test('Notes announces off, connecting, on and updating as capture starts', async () => {
  const runtime = createNotesDemo();
  let admit!: (connection: NotesConnection) => void;
  const connect = vi.fn(
    () =>
      new Promise<NotesConnection>(resolve => {
        admit = resolve;
      })
  );
  const requestCompletion = vi.fn<NotesConnection['requestCompletion']>(
    () => new Promise(() => {})
  );
  const view = render(<NotesDemo runtime={runtime} connect={connect} />);
  const status = screen.getByRole('status');
  expect(status.getAttribute('aria-atomic')).toBe('true');
  expect(status.textContent).toContain('Notes are off');
  expect(connect).not.toHaveBeenCalled();
  view.rerender(<NotesDemo runtime={runtime} connect={connect} listening />);
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
  view.rerender(<NotesDemo runtime={runtime} connect={connect} listening={false} />);
  expect(status.textContent).toContain('Notes are off');
  expect(connect).toHaveBeenCalledOnce();
  view.unmount();
  runtime.close();
});

test('Notes explains an unavailable connection without a separate start control', () => {
  const runtime = createNotesDemo();
  const view = render(<NotesDemo runtime={runtime} />);
  expect(screen.getByRole('status').textContent).toContain('Notes are off');
  expect(screen.getByText(/No model connection is configured/)).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Start notes' })).toBeNull();
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

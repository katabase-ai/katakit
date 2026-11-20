// @vitest-environment happy-dom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import {
  createListExtractionDemo,
  type ListExtractionRuntime,
} from '../../list-extraction-react/src/createListExtractionDemo';
import { ListExtractionDemo } from '../../list-extraction-react/src/ListExtractionDemo';
import {
  ExtractionError,
  type ExtractionConnection,
  type ExtractionConnect,
} from '../../list-extraction-react/src/extractionModel';

const runtimes: ListExtractionRuntime[] = [];
const create = () => {
  const runtime = createListExtractionDemo();
  runtimes.push(runtime);
  return runtime;
};
const turn = (runtime: ListExtractionRuntime, text = 'I will email Sam tomorrow.') => {
  runtime.ingestSegment({ id: crypto.randomUUID(), sourceId: 'mic', text });
  runtime.flush();
};
const connection = (
  requestCompletion: ExtractionConnection['requestCompletion']
): ExtractionConnection => ({
  model: 'test',
  maxBodyBytes: 100000,
  maxOutputTokens: 2048,
  requestCompletion,
});
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
              deadline: 'Tomorrow',
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
afterEach(() => {
  cleanup();
  runtimes.splice(0).forEach(r => r.close());
});

test('local dictation does not admit inference; source changes abort requests and require another explicit extraction', async () => {
  const runtime = create();
  let finish!: (value: unknown) => void;
  let signal!: AbortSignal;
  const request = vi.fn<ExtractionConnection['requestCompletion']>(input => {
    signal = input.signal;
    return new Promise(resolve => {
      finish = resolve;
    });
  });
  const first = vi.fn(async () => connection(request));
  const second = vi.fn(async () => connection(async () => response(runtime, 'Accepted result')));
  const view = render(<ListExtractionDemo runtime={runtime} connect={first} />);
  act(() => turn(runtime));
  expect(first).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Extract lists' }));
  await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
  view.rerender(<ListExtractionDemo runtime={runtime} connect={second} />);
  expect(signal.aborted).toBe(true);
  await act(async () => finish(response(runtime, 'Obsolete result')));
  expect(screen.queryByText('Obsolete result')).toBeNull();
  expect(second).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Extract lists' }));
  await screen.findByText('Accepted result');
  expect(runtime.state$.get().turns).toHaveLength(1);
});

test('unmount cancels pending admission even when the host ignores cancellation', async () => {
  const runtime = create();
  let finish!: (value: ExtractionConnection) => void;
  let signal!: AbortSignal;
  const request = vi.fn(async () => response(runtime));
  const connect: ExtractionConnect = input => {
    signal = input.signal;
    return new Promise(resolve => {
      finish = resolve;
    });
  };
  const view = render(
    <StrictMode>
      <ListExtractionDemo runtime={runtime} connect={connect} />
    </StrictMode>
  );
  act(() => turn(runtime));
  fireEvent.click(screen.getByRole('button', { name: 'Extract lists' }));
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => finish(connection(request)));
  expect(request).not.toHaveBeenCalled();
});

test('capture and terminal allowance failure cannot start extraction; clearing preserves exhaustion', async () => {
  const runtime = create();
  const connect = vi.fn(async () => {
    throw new ExtractionError('Allowance exhausted.', { terminal: true });
  });
  const view = render(<ListExtractionDemo runtime={runtime} connect={connect} listening />);
  act(() => turn(runtime));
  expect(
    (screen.getByRole('button', { name: 'Extract lists' }) as HTMLButtonElement).disabled
  ).toBe(true);
  view.rerender(<ListExtractionDemo runtime={runtime} connect={connect} />);
  fireEvent.click(screen.getByRole('button', { name: 'Extract lists' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'New dictation' }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear dictation' }));
  act(() => turn(runtime, 'Still transcribing locally.'));
  expect(
    (screen.getByRole('button', { name: 'Extract lists' }) as HTMLButtonElement).disabled
  ).toBe(true);
  expect(connect).toHaveBeenCalledOnce();
  expect(runtime.state$.get().turns).toHaveLength(1);
});

test('sample supports independent lists, exact sources, editing, removal/undo and Markdown', async () => {
  const runtime = create();
  render(<ListExtractionDemo runtime={runtime} />);
  fireEvent.click(screen.getByRole('button', { name: '+ Add another list' }));
  fireEvent.click(screen.getByRole('button', { name: 'Try sample' }));
  const output = screen.getByRole('region', { name: 'Extracted lists' });
  fireEvent.click(within(output).getByRole('button', { name: 'Decisions 1' }));
  fireEvent.click(within(output).getByRole('button', { name: 'Show source' }));
  expect(
    within(output).getByText('The decision is to support direct dictation in the first version.')
  ).toBeDefined();
  fireEvent.click(within(output).getByRole('button', { name: 'Edit' }));
  fireEvent.change(within(output).getByLabelText('Item text'), {
    target: { value: 'Ship dictation first' },
  });
  fireEvent.click(within(output).getByRole('button', { name: 'Save' }));
  expect(runtime.state$.get().markdown).toContain('Ship dictation first');
  expect(runtime.state$.get().markdown).toContain('The decision is to support direct dictation');
  fireEvent.click(within(output).getByRole('button', { name: 'Remove' }));
  expect(runtime.state$.get().markdown).not.toContain('Ship dictation first');
  fireEvent.click(within(output).getByRole('button', { name: 'Undo removal' }));
  expect(runtime.state$.get().markdown).toContain('Ship dictation first');
  expect(screen.queryByRole('button', { name: /upload/i })).toBeNull();
});

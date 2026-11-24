// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import {
  bingoDemoDetails,
  colorClashDemoDetails,
  notesDemoDetails,
  listExtractionDemoDetails,
  brainstormDemoDetails,
} from './galleryDemoDetails';
import { GalleryEventsContext } from './galleryEvents';
import { GalleryRunLocally, runLocallyCommand, runLocallyPrompt } from './GalleryRunLocally';

afterEach(cleanup);

test('the command copies the pinned example directory and starts it', () => {
  render(<GalleryRunLocally demo={notesDemoDetails} revision="abc123" />);
  expect(
    screen.getByRole('link', { name: 'View the source code for this example' }).getAttribute('href')
  ).toBe('https://github.com/katabase-ai/katakit/tree/abc123/examples/demos/notes-react');
  expect(runLocallyCommand(notesDemoDetails, 'abc123')).toBe(
    [
      'npx degit katabase-ai/katakit/examples/demos/notes-react#abc123 structured-notes',
      'cd structured-notes',
      'pnpm install',
      'pnpm dev',
    ].join('\n')
  );
  expect(runLocallyCommand(listExtractionDemoDetails, 'abc123')).toContain(
    'npx degit katabase-ai/katakit/examples/demos/list-extraction-react#abc123 list-extraction'
  );
  expect(runLocallyPrompt(listExtractionDemoDetails)).toContain(
    'Ask me before you read, create, or edit'
  );
  expect(runLocallyCommand(bingoDemoDetails)).toMatch(
    /^npx degit katabase-ai\/katakit\/examples\/demos\/bingo-react conversation-bingo\n/
  );
});

test('brainstorming offers the pinned standalone copy and its model setup instructions', () => {
  render(<GalleryRunLocally demo={brainstormDemoDetails} revision="abc123" />);
  expect(screen.getByText('Get the code')).toBeDefined();
  expect(runLocallyCommand(brainstormDemoDetails, 'abc123')).toBe(
    [
      'npx degit katabase-ai/katakit/examples/demos/brainstorm-react#abc123 brainstorming-game',
      'cd brainstorming-game',
      'pnpm install',
      'pnpm dev',
    ].join('\n')
  );
  expect(runLocallyPrompt(brainstormDemoDetails, 'abc123')).toContain(
    'Ask me before you read, create, or edit'
  );
});

test('only a demo that calls a model mentions an API key', () => {
  expect(runLocallyPrompt(notesDemoDetails)).toContain('Ask me before you read, create, or edit');
  expect(runLocallyPrompt(bingoDemoDetails)).not.toMatch(/API key/);
  render(<GalleryRunLocally demo={notesDemoDetails} />);
  expect(screen.getByText('Get the code')).toBeDefined();
  expect(screen.getByText(/connecting your own model API key/)).toBeDefined();
  cleanup();
  render(<GalleryRunLocally demo={bingoDemoDetails} />);
  expect(screen.getByText('Get the code')).toBeDefined();
  expect(screen.queryByText(/API key/)).toBeNull();
});

test('a demo without its own example directory has no control', () => {
  const { container } = render(<GalleryRunLocally demo={colorClashDemoDetails} />);
  expect(container.innerHTML).toBe('');
});

test('copying writes the text and reports which text was copied', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  const report = vi.fn();
  render(
    <GalleryEventsContext value={{ report, setActiveDemo: () => {} }}>
      <GalleryRunLocally demo={notesDemoDetails} revision="abc123" />
    </GalleryEventsContext>
  );
  const [command, prompt] = screen.getAllByRole('button', { name: /Copy/ });
  await act(async () => {
    fireEvent.click(command!);
  });
  expect(writeText).toHaveBeenCalledWith(runLocallyCommand(notesDemoDetails, 'abc123'));
  expect(report).toHaveBeenCalledWith({ type: 'runLocallyCopied', content: 'command' });
  expect(screen.getByRole('button', { name: /Copied/ })).toBeDefined();
  await act(async () => {
    fireEvent.click(prompt!);
  });
  expect(report).toHaveBeenLastCalledWith({ type: 'runLocallyCopied', content: 'prompt' });
});

test('a blocked clipboard asks the visitor to copy by hand', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    configurable: true,
  });
  render(<GalleryRunLocally demo={notesDemoDetails} />);
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name: /Copy/ })[0]!);
  });
  expect(screen.getByRole('alert').textContent).toContain('Select the text and copy it');
});

test('a press outside or Escape closes the open panel; a press inside keeps it', () => {
  render(<GalleryRunLocally demo={bingoDemoDetails} />);
  const details = screen.getByText('Get the code').closest('details')!;
  details.open = true;
  fireEvent.pointerDown(screen.getByText('Command'));
  expect(details.open).toBe(true);
  fireEvent.pointerDown(document.body);
  expect(details.open).toBe(false);
  details.open = true;
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(details.open).toBe(false);
});

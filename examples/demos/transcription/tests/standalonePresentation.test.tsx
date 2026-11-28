// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { CaptureControls } from '../src/ui/CaptureControls';
import { StandaloneCapture, StandaloneDemo } from '../src/ui/StandaloneDemo';

afterEach(cleanup);

test('capture feedback reflects setup, listening and failures without owning input', () => {
  let toggles = 0;
  const onToggle = () => toggles++;
  const view = render(
    <CaptureControls input={{ phase: 'idle' }} active={false} onToggle={onToggle} />
  );
  fireEvent.click(view.getByRole('button', { name: 'Start listening' }));
  expect(toggles).toBe(1);
  expect(view.getByRole('status').textContent).toBe('Microphone off');

  view.rerender(
    <CaptureControls
      input={{ phase: 'loading', progress: 0.5 }}
      active={false}
      busy
      onToggle={onToggle}
    />
  );
  expect(view.getByRole('button', { name: 'Preparing…' }).hasAttribute('disabled')).toBe(true);
  expect(view.getByRole('status').textContent).toContain('50%');

  view.rerender(<CaptureControls input={{ phase: 'running' }} active onToggle={onToggle} />);
  expect(view.getByRole('button', { name: 'Pause listening' })).toBeTruthy();
  expect(view.getByRole('img', { name: 'Microphone listening' })).toBeTruthy();

  view.rerender(
    <CaptureControls
      input={{
        phase: 'error',
        error: {
          name: 'TranscriptionError',
          code: 'microphone-permission-denied',
          message: 'Permission denied',
        },
      }}
      active={false}
      onToggle={onToggle}
    />
  );
  expect(view.getByRole('button', { name: 'Start listening' }).textContent).toBe('Try again');
  expect(view.getByRole('alert').textContent).toBe('Permission denied');
});

test('a game-owned action can render under the standalone title', () => {
  const view = render(
    <StandaloneDemo title="Game" description="Speak to play.">
      <section>
        <StandaloneCapture>
          <button type="button">Play</button>
        </StandaloneCapture>
        <p>Game board</p>
      </section>
    </StandaloneDemo>
  );
  expect(view.getByRole('banner').querySelector('button')?.textContent).toBe('Play');
  expect(view.getByText('Game board')).toBeTruthy();
  act(() => view.unmount());
});

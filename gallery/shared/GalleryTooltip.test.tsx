// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { GalleryTooltipButton } from './GalleryTooltip';
import { GalleryModeProvider, GalleryPreviewToggle } from './GalleryModeProvider';

afterEach(cleanup);

test('hover explains a control without activating it, and Escape works while focus is elsewhere', () => {
  const action = vi.fn();
  render(
    <>
      <button>Other control</button>
      <GalleryTooltipButton description="Configure operations" onClick={action}>
        Settings
      </GalleryTooltipButton>
    </>
  );
  const button = screen.getByRole('button', { name: 'Settings' });
  act(() => screen.getByRole('button', { name: 'Other control' }).focus());
  fireEvent.pointerEnter(button);
  const help = screen.getByRole('tooltip');
  expect(help.textContent).toBe('Configure operations');
  expect(button.getAttribute('aria-describedby')).toBe(help.id);
  expect(action).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).toBeNull();
  expect(button.getAttribute('aria-describedby')).toBeNull();
});

test('focus keeps help open after pointer exit; blur and outside pointer dismiss it', () => {
  render(
    <>
      <button>Other control</button>
      <GalleryTooltipButton description="Ready">Status</GalleryTooltipButton>
    </>
  );
  const button = screen.getByRole('button', { name: 'Status' });
  act(() => button.focus());
  fireEvent.pointerLeave(button);
  expect(screen.getByRole('tooltip').textContent).toBe('Ready');
  act(() => screen.getByRole('button', { name: 'Other control' }).focus());
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.pointerEnter(button);
  fireEvent.pointerLeave(button);
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.click(button);
  expect(screen.getByRole('tooltip')).toBeDefined();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('tooltip')).toBeNull();
});

test('tapping informational buttons opens help; action buttons dismiss help and run once', () => {
  const action = vi.fn();
  render(
    <>
      <GalleryTooltipButton description="Not set up">Status</GalleryTooltipButton>
      <GalleryTooltipButton description="Configure operations" onClick={action}>
        Settings
      </GalleryTooltipButton>
    </>
  );
  act(() => screen.getByRole('button', { name: 'Status' }).focus());
  fireEvent.click(screen.getByRole('button', { name: 'Status' }));
  expect(screen.getByRole('tooltip').textContent).toBe('Not set up');
  act(() => screen.getByRole('button', { name: 'Settings' }).focus());
  expect(screen.getByRole('tooltip').textContent).toBe('Configure operations');
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect(action).toHaveBeenCalledOnce();
  expect(screen.queryByRole('tooltip')).toBeNull();
});

test('tooltip descriptions preserve existing accessible help on the trigger', () => {
  render(
    <>
      <p id="existing-help">Existing help</p>
      <GalleryTooltipButton aria-describedby="existing-help" description="Ready">
        Status
      </GalleryTooltipButton>
    </>
  );
  const button = screen.getByRole('button', { name: 'Status' });
  expect(button.getAttribute('aria-describedby')).toBe('existing-help');
  fireEvent.focus(button);
  expect(button.getAttribute('aria-describedby')).toBe(
    `existing-help ${screen.getByRole('tooltip').id}`
  );
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(button.getAttribute('aria-describedby')).toBe('existing-help');
});

test('the mode switch uses shared help without adding a button or changing its switch action', () => {
  const onChange = vi.fn();
  render(
    <GalleryModeProvider developerMode>
      <GalleryPreviewToggle onChange={onChange} />
    </GalleryModeProvider>
  );
  const control = screen.getByRole('switch', { name: 'Developer mode' });
  act(() => control.focus());
  expect(screen.getByRole('tooltip').textContent).toBe('Configure and test model connections.');
  expect(control.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.click(control);
  expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
  expect((screen.getByRole('switch', { name: 'Public preview' }) as HTMLInputElement).checked).toBe(
    true
  );
  expect(screen.queryByRole('tooltip')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
  fireEvent.pointerEnter(control);
  expect(screen.getByRole('tooltip').textContent).toBe(
    'This is what people will see on the public gallery.'
  );
});

import { fireEvent, render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { Timeline } from './timeline';
import type { Delivery } from './deliveries';

test('zoom preserves the time under the viewport center; Follow and Fit restore the latest delivery', () => {
  const events: Delivery[] = [0, 1000].map((time, i) => ({
    time,
    messageNumber: i + 1,
    lane: '#1 Bingo.state$',
    stack: '',
    value: i,
  }));
  const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
  const view = render(
    <Timeline
      events={events}
      hidden={new Set()}
      toggleLane={vi.fn()}
      onPreview={vi.fn()}
      onPin={vi.fn()}
    />
  );
  try {
    const viewport = view.getByLabelText('Scrollable delivery timeline');
    const follow = view.getByRole('button', { name: 'Follow latest delivery' });
    fireEvent.click(view.getByRole('button', { name: 'Zoom in' }));
    // The plot has 14px padding, so doubling the scale shifts 200 - 14px.
    expect(viewport.scrollLeft).toBeCloseTo(186);
    expect(follow.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(follow);
    expect(viewport.scrollLeft).toBe(372);
    fireEvent.click(view.getByRole('button', { name: 'Fit recording' }));
    expect(viewport.scrollLeft).toBe(0);
    expect(follow.getAttribute('aria-pressed')).toBe('true');
  } finally {
    view.unmount();
    width.mockRestore();
  }
});

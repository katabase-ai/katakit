import { fireEvent, render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { Timeline } from '../timeline';

test('zoom preserves the time under the viewport center; Follow and Fit restore the latest delivery', () => {
  const events = [0, 1000].map((time, i) => ({
    time,
    id: `event-${i}`,
    laneId: 'state',
  }));
  const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
  const view = render(<Timeline events={events} lanes={[{ id: 'state', label: 'State' }]} />);
  try {
    const viewport = view.getByLabelText('Scrollable event timeline');
    const follow = view.getByRole('button', { name: 'Follow latest event' });
    fireEvent.click(view.getByRole('button', { name: 'Zoom in' }));
    // The plot has 14px padding, so doubling the scale shifts 200 - 14px.
    expect(viewport.scrollLeft).toBeCloseTo(186);
    expect(follow.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(follow);
    expect(viewport.scrollLeft).toBe(372);
    fireEvent.click(view.getByRole('button', { name: 'Fit timeline' }));
    expect(viewport.scrollLeft).toBe(0);
    expect(follow.getAttribute('aria-pressed')).toBe('true');
  } finally {
    view.unmount();
    width.mockRestore();
  }
});

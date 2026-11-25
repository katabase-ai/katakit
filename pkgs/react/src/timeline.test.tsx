import { fireEvent, render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { Timeline } from './timeline';

test('renders generic lanes and millisecond events, selecting stable IDs across reordered input', () => {
  const onSelect = vi.fn();
  const lanes = [
    { id: 'audio', label: 'Audio', color: '#ff8800' },
    { id: 'text', label: 'Text' },
  ];
  const events = [
    { id: 'b', laneId: 'audio', time: 1100 },
    { id: 'a', laneId: 'audio', time: 1000 },
    { id: 'c', laneId: 'text', time: 2000 },
  ];
  const view = render(
    <Timeline lanes={lanes} events={events} playheadTime={1500} onSelect={onSelect} />
  );
  expect(view.getByRole('button', { name: /Audio, 0.000s, 2 events/ })).toBeTruthy();
  expect(view.getByLabelText('Text')).toBeTruthy();
  expect(
    view.container.querySelector('.katakit-timeline-playhead')?.getAttribute('x1')
  ).not.toBeNull();
  fireEvent.click(view.getByRole('button', { name: /Audio, 0.000s, 2 events/ }));
  expect(onSelect).toHaveBeenLastCalledWith('a');
  view.rerender(
    <Timeline lanes={lanes} events={events.toReversed()} selectedId="a" onSelect={onSelect} />
  );
  fireEvent.click(view.getByRole('button', { name: /Audio, 0.000s, 2 events/ }));
  expect(onSelect).toHaveBeenLastCalledWith('b');
  fireEvent.click(view.getByRole('button', { name: 'Choose lanes' }));
  fireEvent.click(view.getByRole('checkbox', { name: 'Audio' }));
  expect(view.queryByLabelText('Audio', { selector: 'svg' })).toBeNull();
  view.unmount();
});

test('renders empty caller data without a capture source and selects by keyboard', () => {
  const onSelect = vi.fn();
  const view = render(<Timeline lanes={[]} events={[]} emptyLabel="Nothing recorded" />);
  expect(view.getByText('Nothing recorded')).toBeTruthy();
  view.rerender(
    <Timeline
      lanes={[{ id: 'custom', label: 'Custom lane' }]}
      events={[{ id: 'stable', laneId: 'custom', time: 42 }]}
      onSelect={onSelect}
    />
  );
  fireEvent.keyDown(view.getByRole('button', { name: /Custom lane, 0.000s/ }), { key: 'Enter' });
  expect(onSelect).toHaveBeenCalledWith('stable');
  view.unmount();
});

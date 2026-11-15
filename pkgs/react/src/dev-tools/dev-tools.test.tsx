import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DevTools, ObservableInspector, type InspectionSource } from './index';
import { formatValue } from './formatValue';

afterEach(cleanup);

const makeSource = () => {
  let observer: Parameters<InspectionSource['subscribe']>[0] | undefined;
  const unsubscribe = vi.fn();
  const source: InspectionSource = {
    get: () => ({ count: 0 }),
    subscribe: vi.fn(next => {
      observer = next;
      return { unsubscribe };
    }),
  };
  return { source, unsubscribe, observer: () => observer! };
};

describe('developer tools', () => {
  it('subscribes on opening and releases subscriptions on closing and unmounting', async () => {
    const { source, unsubscribe } = makeSource();
    const { unmount } = render(<DevTools observables={{ counter: source }} />);
    expect(source.subscribe).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Show developer tools' }));
    expect(source.subscribe).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/"count": 0/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hide developer tools' }));
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Show developer tools' }));
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });

  it('captures live snapshots and bounds history to the newest 50 emissions', () => {
    const { source, observer } = makeSource();
    render(<ObservableInspector name="counter" source={source} />);
    act(() => {
      for (let count = 0; count < 60; count++) observer().next({ count });
    });
    expect(screen.getByRole('tabpanel').textContent).toContain('"count": 59');
    fireEvent.click(screen.getByRole('tab', { name: 'Recent emissions (50)' }));
    const entries = screen.getAllByRole('listitem');
    expect(entries).toHaveLength(50);
    expect(entries[0]?.textContent).toContain('"count": 59');
    expect(entries.at(-1)?.textContent).toContain('"count": 10');
  });

  it('supports replayed values and completion', () => {
    const source: InspectionSource = {
      subscribe: observer => {
        observer.next('first');
        observer.next('second');
        observer.complete();
        return { unsubscribe: vi.fn() };
      },
    };
    render(<ObservableInspector name="events" source={source} />);
    expect(screen.getByText('complete')).toBeTruthy();
    expect(screen.getByRole('tabpanel').textContent).toBe('"second"');
    expect(screen.getByRole('tab', { name: 'Recent emissions (2)' })).toBeTruthy();
  });

  it('shows source errors and replaces subscriptions when a source changes', () => {
    const first = makeSource();
    const second = makeSource();
    const { rerender } = render(<ObservableInspector name="counter" source={first.source} />);
    act(() => first.observer().error(new Error('Stream failed')));
    expect(screen.getByRole('alert').textContent).toContain('Stream failed');
    rerender(<ObservableInspector name="counter" source={second.source} />);
    expect(first.unsubscribe).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).toBeNull();
    act(() => first.observer().next('stale'));
    expect(screen.getByRole('tabpanel').textContent).not.toContain('stale');
  });

  it('isolates source failures from other inspectors', () => {
    const broken: InspectionSource = {
      subscribe: () => {
        throw new Error('Broken source');
      },
    };
    const working = makeSource();
    render(<DevTools observables={{ broken, working: working.source }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show developer tools' }));
    expect(screen.getByRole('alert').textContent).toContain('Broken source');
    const inspector = screen.getByRole('region', { name: 'working inspector' });
    act(() => working.observer().next('still live'));
    expect(within(inspector).getByRole('tabpanel').textContent).toContain('still live');
  });

  it('renders an empty state without configured sources', () => {
    render(<DevTools observables={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show developer tools' }));
    expect(screen.getByText('No observables configured.')).toBeTruthy();
  });

  it('formats non-JSON values, circular references, errors, and throwing serializers', () => {
    const value: { bigint: bigint; self?: unknown } = { bigint: 12n };
    value.self = value;
    expect(formatValue(value)).toContain('12n');
    expect(formatValue(value)).toContain('Circular');
    expect(formatValue(undefined)).toBe('undefined');
    expect(formatValue(new Error('failure'))).toContain('failure');
    expect(
      formatValue({
        toJSON: () => {
          throw new Error('bad JSON');
        },
      })
    ).toBe('[Unable to serialize value]');
    expect(formatValue('x'.repeat(21_000))).toContain('(truncated)');
  });
});

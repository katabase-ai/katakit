// @vitest-environment happy-dom
import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { bind, Subscribe } from '@react-rxjs/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { property } from '@katakit/core';
import { afterEach, expect, test } from 'vitest';

afterEach(cleanup);

test('bind and Subscribe render property updates and release the UI subscription', () => {
  const subject = new BehaviorSubject(1);
  const count$ = property(subject.asObservable());
  let activeSubscriptions = 0;
  const source$ = new Observable<number>(observer => {
    activeSubscriptions++;
    const subscription = count$.subscribe(observer);
    return () => {
      subscription.unsubscribe();
      activeSubscriptions--;
    };
  });
  const [useCount, countState$] = bind(source$);
  const CounterView = () => <output>{useCount()}</output>;
  const view = (
    <StrictMode>
      <Subscribe source$={countState$}>
        <CounterView />
        <CounterView />
      </Subscribe>
    </StrictMode>
  );

  // A property may have changed before React first mounts.
  subject.next(2);
  const first = render(view);
  expect(first.getAllByRole('status').map(node => node.textContent)).toEqual(['2', '2']);
  expect(activeSubscriptions).toBe(1);
  act(() => subject.next(3));
  expect(first.getAllByRole('status').map(node => node.textContent)).toEqual(['3', '3']);

  first.unmount();
  expect(activeSubscriptions).toBe(0);
  // UI cleanup does not dispose the source: remount reads its latest value.
  subject.next(4);
  const second = render(view);
  expect(second.getAllByRole('status').map(node => node.textContent)).toEqual(['4', '4']);
  expect(activeSubscriptions).toBe(1);
  second.unmount();
  expect(activeSubscriptions).toBe(0);
});

test('one boundary owns multiple bound streams and renders updates from each', () => {
  const transcript$ = new BehaviorSubject('hello');
  const board$ = new BehaviorSubject(0);
  const [useTranscript, transcriptState$] = bind(transcript$);
  const [useBoard, boardState$] = bind(board$);
  const view$ = combineLatest([transcriptState$, boardState$]);
  const View = () => <output>{`${useTranscript()}: ${useBoard()}`}</output>;
  const view = render(
    <Subscribe source$={view$}>
      <View />
    </Subscribe>
  );

  expect(view.getByRole('status').textContent).toBe('hello: 0');
  act(() => transcript$.next('latest'));
  expect(view.getByRole('status').textContent).toBe('latest: 0');
  act(() => board$.next(1));
  expect(view.getByRole('status').textContent).toBe('latest: 1');
  view.unmount();
  expect(transcript$.observed).toBe(false);
  expect(board$.observed).toBe(false);
});

// @vitest-environment happy-dom
import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { bind, Subscribe } from '@react-rxjs/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { makeKatakit, property } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import { afterEach, expect, test } from 'vitest';
import { createTranscriptionDemo } from '../src/transcription/createTranscriptionDemo';
import { TranscriptView } from '../src/transcription/TranscriptView';

afterEach(cleanup);

test('the demo view follows its runtime through updates, remount and replacement', () => {
  const first = createTranscriptionDemo();
  first.ingestSegment({ id: 'one', sourceId: 'first', text: 'First visit' });
  first.flush();
  const view = render(
    <StrictMode>
      <TranscriptView runtime={first} />
    </StrictMode>
  );
  expect(view.getByText('First visit')).toBeTruthy();
  act(() => first.updateProvisional('Draft'));
  expect(view.getByText('Draft')).toBeTruthy();
  view.unmount();

  const replay = createTranscriptionDemo({ initialEvents: first.events$.getAll() });
  const remount = render(<TranscriptView runtime={replay} />);
  expect(remount.getByText('First visit')).toBeTruthy();
  expect(remount.getByText('Draft')).toBeTruthy();
  const next = createTranscriptionDemo();
  remount.rerender(<TranscriptView runtime={next} />);
  expect(remount.queryByText('First visit')).toBeNull();
  act(() => replay.updateProvisional('Old visit'));
  expect(remount.queryByText('Old visit')).toBeNull();
  act(() => next.ingestSegment({ id: 'one', sourceId: 'next', text: 'Next visit' }));
  expect(remount.getByText('Next visit')).toBeTruthy();
  remount.unmount();
  first.close();
  replay.close();
  next.close();
});

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

test('transcription bindings render empty, pending and completed turns across remounts', () => {
  const TranscriptIngestionPlugin = makeTranscriptIngestionPlugin();
  const kit = makeKatakit({ plugins: [TranscriptIngestionPlugin.configure({})] });
  const methods = kit.start().getMethods(TranscriptIngestionPlugin);
  const { collectedConversationTurns$, pendingConversationTurn$, provisionalUtterance$ } =
    kit.getObservables(TranscriptIngestionPlugin);
  const [useTurns, turnsState$] = bind(collectedConversationTurns$);
  const [useCurrent, currentState$] = bind(pendingConversationTurn$);
  const [useProvisional, provisionalState$] = bind(provisionalUtterance$);
  const view$ = combineLatest([turnsState$, currentState$, provisionalState$]);
  const View = () => (
    <output>{`${useTurns().length}|${useCurrent()?.text ?? '-'}|${useProvisional()?.text ?? '-'}`}</output>
  );
  const view = render(
    <Subscribe source$={view$}>
      <View />
    </Subscribe>
  );

  expect(view.getByRole('status').textContent).toBe('0|-|-');
  act(() => methods.updateProvisionalUtterance({ text: 'Hello', speaker: 'mic' }));
  expect(view.getByRole('status').textContent).toBe('0|-|Hello');
  act(() =>
    methods.ingestUtterance({ id: '1', speaker: 'mic', text: 'Hello.', startMs: 0, endMs: 100 })
  );
  expect(view.getByRole('status').textContent).toBe('0|Hello.|-');
  act(() => methods.flush());
  expect(view.getByRole('status').textContent).toBe('1|-|-');

  view.unmount();
  const remounted = render(
    <Subscribe source$={view$}>
      <View />
    </Subscribe>
  );
  expect(remounted.getByRole('status').textContent).toBe('1|-|-');
  remounted.unmount();
  methods.close();
});

import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { context } from '@opentelemetry/api';
import { StackContextManager, TracerProvider } from '@opentelemetry/sdk-trace';
import { BehaviorSubject, Subject } from 'rxjs';
import { afterEach, expect, test, vi } from 'vitest';
import { makeEffect, makeKatakit, makeKatakitPlugin } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import { DevTools, createDevToolsStore } from './index';
import { formatValue } from './formatValue';

const releases: (() => void)[] = [];
afterEach(() => {
  cleanup();
  releases.splice(0).forEach(release => release());
  context.disable();
});

const setup = () => {
  context.setGlobalContextManager(new StackContextManager().enable());
  const store = createDevToolsStore({ scopeName: 'test-workbench' });
  const provider = new TracerProvider({ spanProcessors: [store.spanProcessor] });
  const source$ = new Subject<number>();
  const value$ = new BehaviorSubject(0);
  const transcript = makeTranscriptIngestionPlugin();
  const producer = makeKatakitPlugin({
    type: 'Producer',
    configure: () => ({}),
    methods: () => ({
      publish: (value: number) => source$.next(value),
      fail: () => {
        throw new TypeError('private failure');
      },
    }),
  });
  const consumer = makeKatakitPlugin({
    type: 'Consumer',
    configure: () => ({}),
    observables: () => ({ value$ }),
    methods: () => ({ setValue: (value: number) => value$.next(value) }),
    effects: ({ methods }) => [
      makeEffect({
        name: 'consume',
        on: source$,
        backpressure: 'queue',
        handler: value => methods.setValue(value),
      }),
    ],
  });
  const runtime = makeKatakit({
    plugins: [producer.configure({}), consumer.configure({}), transcript.configure({})],
    tracer: provider.getTracer('test-workbench'),
  }).start();
  releases.push(() => {
    source$.complete();
    value$.complete();
    runtime.getMethods(transcript).close();
    void provider.shutdown();
  });
  return { store, runtime, producer, consumer, transcript, value$ };
};
const open = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Open developer workbench' }));

test('discovers declared capabilities before activity and preserves capture through view changes', () => {
  const fixture = setup();
  render(
    <StrictMode>
      <DevTools runtime={fixture.runtime} store={fixture.store} />
    </StrictMode>
  );
  open();
  fireEvent.click(screen.getByRole('tab', { name: 'State & capabilities' }));
  const consumer = screen.getByRole('region', { name: 'Consumer capabilities' });
  expect(within(consumer).getByText('setValue')).toBeTruthy();
  expect(within(consumer).getByText('consume')).toBeTruthy();
  expect(within(consumer).getAllByText(/0 captured calls/)).toHaveLength(2);
  act(() => fixture.runtime.getMethods(fixture.consumer).setValue(11));
  fireEvent.click(screen.getByRole('button', { name: 'Hide developer workbench' }));
  act(() => fixture.runtime.getMethods(fixture.consumer).setValue(12));
  open();
  expect(
    screen.getByRole('tab', { name: 'State & capabilities' }).getAttribute('aria-selected')
  ).toBe('true');
  expect(within(consumer).getByText('12')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear captured history' }));
  expect(fixture.store.getSnapshot().activity).toHaveLength(0);
  expect(fixture.value$.value).toBe(12);
  expect(within(consumer).getByText('12')).toBeTruthy();
});

test('shows real spans and lets a developer navigate recorded parent relationships', async () => {
  const fixture = setup();
  render(<DevTools runtime={fixture.runtime} store={fixture.store} />);
  open();
  act(() => fixture.runtime.getMethods(fixture.producer).publish(4));
  await waitFor(() => expect(fixture.value$.value).toBe(4));
  const records = screen.getByRole('region', { name: 'Activity records' });
  fireEvent.click(within(records).getByRole('button', { name: /effect consume/ }));
  const details = screen.getByRole('complementary', { name: 'Activity details' });
  expect(within(details).getByText('Parent invocation')).toBeTruthy();
  fireEvent.click(within(details).getByRole('button', { name: 'Producer.publish' }));
  expect(within(details).getByText('Producer / publish')).toBeTruthy();
  expect(within(details).getByRole('button', { name: 'effect · consume' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'effect' } });
  expect(within(records).getAllByRole('button')).toHaveLength(1);
  fireEvent.change(screen.getByLabelText('Search activity'), { target: { value: 'absent' } });
  expect(within(records).queryAllByRole('button')).toHaveLength(0);
});

test('holds a paused record view while capture continues and still respects clear', () => {
  const fixture = setup();
  render(<DevTools runtime={fixture.runtime} store={fixture.store} />);
  open();
  fireEvent.click(screen.getByLabelText('Follow live'));
  act(() => fixture.runtime.getMethods(fixture.consumer).setValue(12));
  const records = screen.getByRole('region', { name: 'Activity records' });
  expect(within(records).queryByRole('button', { name: /method setValue/ })).toBeNull();
  expect(fixture.store.getSnapshot().activity.some(entry => entry.kind === 'method')).toBe(true);
  fireEvent.click(screen.getByLabelText('Follow live'));
  expect(within(records).getByRole('button', { name: /method setValue/ })).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Follow live'));
  fireEvent.click(screen.getByRole('button', { name: 'Clear captured history' }));
  expect(within(records).queryAllByRole('button')).toHaveLength(0);
});

test('exposes method failures without requiring state changes', () => {
  const fixture = setup();
  render(<DevTools runtime={fixture.runtime} store={fixture.store} />);
  open();
  act(() => {
    expect(() => fixture.runtime.getMethods(fixture.producer).fail()).toThrow('private failure');
  });
  const records = screen.getByRole('region', { name: 'Activity records' });
  fireEvent.click(within(records).getByRole('button', { name: /method fail/ }));
  expect(
    within(screen.getByRole('complementary', { name: 'Activity details' })).getByText('TypeError')
  ).toBeTruthy();
  expect(screen.queryByText('private failure')).toBeNull();
});

test('submits transcript input through real ingestion and keeps drafts and microphone ownership across tabs', () => {
  const fixture = setup();
  const onToggle = vi.fn();
  render(
    <DevTools
      runtime={fixture.runtime}
      store={fixture.store}
      transcript={{
        observables: fixture.runtime.getObservables(fixture.transcript),
        methods: fixture.runtime.getMethods(fixture.transcript),
        input: { status: 'ready', recording: false, onToggle },
      }}
    />
  );
  open();
  fireEvent.click(screen.getByRole('tab', { name: 'Transcript & input' }));
  fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Quick question' } });
  fireEvent.change(screen.getByLabelText('Speaker (optional)'), {
    target: { value: 'A developer' },
  });
  fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Transcript & input' }));
  expect((screen.getByLabelText('Text') as HTMLTextAreaElement).value).toBe('Quick question');
  expect(onToggle).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Submit segment' }));
  expect(fixture.runtime.getObservables(fixture.transcript).currentTurn$.get()?.text).toBe(
    'Quick question'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Finalize turn' }));
  expect(fixture.runtime.getObservables(fixture.transcript).conversationTurns$.get()).toHaveLength(
    1
  );
  fireEvent.click(screen.getByRole('button', { name: 'Start microphone' }));
  expect(onToggle).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Hide developer workbench' }));
  expect(onToggle).toHaveBeenCalledOnce();
});

test('supports empty runtimes without offering transcript controls', () => {
  render(
    <DevTools
      runtime={makeKatakit({ plugins: [], tracer: false }).start()}
      store={createDevToolsStore()}
    />
  );
  open();
  expect(screen.getByText('No plugins configured.')).toBeTruthy();
  expect(screen.queryByRole('tab', { name: 'Transcript & input' })).toBeNull();
  expect(screen.getByText('Trace instrumentation disabled for this runtime.')).toBeTruthy();
});

test('formats circular data, bigint, errors and uncooperative serializers', () => {
  const value: { bigint: bigint; self?: unknown } = { bigint: 12n };
  value.self = value;
  expect(formatValue(value)).toContain('12n');
  expect(formatValue(value)).toContain('Circular');
  expect(formatValue(new Error('failure'))).toContain('failure');
  expect(
    formatValue({
      toJSON: () => {
        throw new Error('bad JSON');
      },
    })
  ).toBe('[Unable to serialize value]');
});

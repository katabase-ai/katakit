import {
  makeKatakit,
  makeKatakitPlugin,
  optionalProperty,
  property,
  skipReplay,
} from '@katakit/core';
import { makeEventLogPlugin } from '@katakit/event-log';
import {
  Observable,
  ReplaySubject,
  Subject,
  distinctUntilChanged,
  filter,
  map,
  merge,
  scan,
  shareReplay,
  startWith,
  takeUntil,
} from 'rxjs';

/** Caller-owned identity and timing of one finalized source segment. */
export type TranscriptSegment = {
  id: string;
  sourceId: string;
  text: string;
  speaker?: string;
  startMs?: number;
  endMs?: number;
};
/** A completed or pending turn; its identity is retained when replayed. */
export type TranscriptTurn = TranscriptSegment;
/** Replayable content. Provisional input and timer state never enter the log. */
export type TranscriptRecordedEvent =
  | { type: 'segment'; segment: TranscriptSegment }
  | { type: 'turn'; turn: TranscriptTurn }
  | { type: 'reset' };
/** Live notifications; replay never triggers this stream. */
export type TranscriptEvent =
  | TranscriptRecordedEvent
  | { type: 'provisional'; text: string | undefined };
/** Atomic finalized-content projection, including the still-open turn. */
export type TranscriptState = {
  segments: TranscriptSegment[];
  conversationTurns: TranscriptTurn[];
  currentTurn: TranscriptTurn | undefined;
};
/**
 * Connect to a caller-owned @katakit/event-log runtime. The stream must replay its
 * complete ordered history synchronously; emitEvent must validate and publish synchronously.
 * Validate restored history before constructing the runtime. Mappings must round-trip
 * all recorded variants; return undefined only for unrelated host events.
 */
export type TranscriptEventLog<TEvent> = {
  events$: Observable<TEvent>;
  emitEvent: (event: TEvent) => void;
  toEvent: (event: TranscriptRecordedEvent) => TEvent;
  fromEvent: (event: TEvent) => TranscriptRecordedEvent | undefined;
};
const emptyState = (): TranscriptState => ({
  segments: [],
  conversationTurns: [],
  currentTurn: undefined,
});
const identity = (segment: TranscriptSegment) => JSON.stringify([segment.sourceId, segment.id]);
const boundary = (current: TranscriptTurn, segment: TranscriptSegment, silence: number) =>
  current.sourceId !== segment.sourceId ||
  current.speaker !== segment.speaker ||
  (segment.startMs !== undefined &&
    current.endMs !== undefined &&
    segment.startMs - current.endMs > silence);
const validContent = (value: unknown): value is TranscriptSegment => {
  if (!value || typeof value !== 'object') return false;
  const s = value as TranscriptSegment;
  return (
    typeof s.id === 'string' &&
    typeof s.sourceId === 'string' &&
    typeof s.text === 'string' &&
    !!s.text.trim() &&
    (s.speaker === undefined || typeof s.speaker === 'string') &&
    (s.startMs === undefined || (typeof s.startMs === 'number' && Number.isFinite(s.startMs))) &&
    (s.endMs === undefined || (typeof s.endMs === 'number' && Number.isFinite(s.endMs)))
  );
};
/** Validate a restored or live record synchronously; throws before projection on malformed content. */
export const parseTranscriptRecordedEvent = (value: unknown): TranscriptRecordedEvent => {
  const event = value as TranscriptRecordedEvent;
  if (
    !event ||
    (event.type !== 'reset' &&
      !(event.type === 'segment' && validContent(event.segment)) &&
      !(event.type === 'turn' && validContent(event.turn)))
  )
    throw new Error('Invalid transcript event');
  return event;
};
const validateRecord = parseTranscriptRecordedEvent;
/**
 * Pure projection for hosts deriving other content from the same log. Segment identity
 * is (sourceId,id); reset starts a fresh identity scope. Raw segment-only snapshots
 * split deterministically on source/speaker/timestamp boundaries, without writing events.
 * Legacy turn-only records retain their IDs but cannot deduplicate unknown segment IDs.
 */
export const reduceTranscriptEvent = (
  state: TranscriptState,
  event: TranscriptRecordedEvent,
  turnSilenceMs = 1400
): TranscriptState => {
  validateRecord(event);
  if (event.type === 'reset') return emptyState();
  if (event.type === 'turn') {
    if (state.conversationTurns.some(turn => identity(turn) === identity(event.turn))) return state;
    return {
      ...state,
      conversationTurns: [...state.conversationTurns, event.turn],
      currentTurn: undefined,
    };
  }
  const segment = event.segment;
  if (state.segments.some(existing => identity(existing) === identity(segment))) return state;
  let current = state.currentTurn;
  let conversationTurns = state.conversationTurns;
  if (current && boundary(current, segment, turnSilenceMs)) {
    conversationTurns = [...conversationTurns, current];
    current = undefined;
  }
  return {
    segments: [...state.segments, segment],
    conversationTurns,
    currentTurn: current
      ? {
          ...current,
          text: `${current.text} ${segment.text}`,
          endMs: segment.endMs ?? current.endMs,
        }
      : { ...segment, id: `${segment.sourceId}\0${segment.id}` },
  };
};
/**
 * Assemble source-neutral segments from a caller's event log. Without eventLog, a
 * private in-memory @katakit/event-log preserves the original zero-configuration API.
 * Only live ingest starts silence timers. close drains live pending input, cancels the
 * timer and releases this plugin's subscriptions; it does not stop host audio or the log.
 */
export const makeTranscriptIngestionPlugin = <TEvent = never>({
  turnSilenceMs = 1400,
  eventLog,
  forward,
}: {
  turnSilenceMs?: number;
  eventLog?: TranscriptEventLog<TEvent>;
  /** Legacy live notification sink; not a content authority. Prefer eventLog. */
  forward?: {
    createEvent: (event: TranscriptEvent) => TEvent | undefined;
    emitEvent: (event: TEvent) => void;
  };
} = {}) => {
  if (!Number.isFinite(turnSilenceMs) || turnSilenceMs < 0)
    throw new Error('turnSilenceMs must be a nonnegative number');
  const controlKey = Symbol('transcript-controls');
  type Controls = {
    append: (event: TranscriptRecordedEvent) => void;
    provisional: Subject<Extract<TranscriptEvent, { type: 'provisional' }>>;
    stop: Subject<void>;
  };
  return makeKatakitPlugin({
    type: 'TranscriptIngestion',
    configure: (_options: {}) => ({}),
    observables: () => {
      const local = makeEventLogPlugin<TranscriptRecordedEvent>({
        validateEvent: {
          '~standard': {
            version: 1,
            vendor: 'transcript-ingestion',
            validate: value => ({ value: validateRecord(value as TranscriptRecordedEvent) }),
          },
        },
      });
      const runtime = eventLog
        ? undefined
        : makeKatakit({ plugins: [local.configure({ initialEvents: [] })] }).start();
      const source$ = eventLog
        ? eventLog.events$.pipe(
            map(eventLog.fromEvent),
            filter((event): event is TranscriptRecordedEvent => event !== undefined),
            map(validateRecord)
          )
        : runtime!.getObservables(local).events$;
      const records$ = new Observable<TranscriptRecordedEvent>(subscriber =>
        source$.subscribe(subscriber)
      );
      const append = eventLog
        ? (event: TranscriptRecordedEvent) => eventLog.emitEvent(eventLog.toEvent(event))
        : runtime!.getMethods(local).emitEvent;
      const stop = new ReplaySubject<void>(1);
      const provisional = new Subject<Extract<TranscriptEvent, { type: 'provisional' }>>();
      const state$ = property(
        records$.pipe(
          scan((state, event) => reduceTranscriptEvent(state, event, turnSilenceMs), emptyState()),
          startWith(emptyState()),
          takeUntil(stop),
          shareReplay({ bufferSize: 1, refCount: true })
        )
      );
      const conversationTurns$ = property(
        state$.pipe(
          map(state => state.conversationTurns),
          distinctUntilChanged()
        )
      );
      const currentTurn$ = optionalProperty(
        state$.pipe(
          map(state => state.currentTurn),
          distinctUntilChanged()
        )
      );
      const segments$ = property(
        state$.pipe(
          map(state => state.segments),
          distinctUntilChanged()
        )
      );
      const provisional$ = optionalProperty(
        merge(
          provisional.pipe(map(event => event.text)),
          records$.pipe(
            filter(event => event.type === 'reset'),
            map(() => undefined)
          )
        ).pipe(
          startWith(undefined),
          takeUntil(stop),
          shareReplay({ bufferSize: 1, refCount: true })
        )
      );
      const lastHeard$ = optionalProperty(
        state$.pipe(
          map(state => state.currentTurn?.text ?? state.conversationTurns.at(-1)?.text),
          distinctUntilChanged()
        )
      );
      const events$ = merge(records$.pipe(skipReplay()), provisional).pipe(takeUntil(stop));
      // Recorder wrappers proxy streams but replace the observable collection.
      Object.defineProperty(state$, controlKey, { value: { append, provisional, stop } });
      const observables = {
        state$,
        segments$,
        conversationTurns$,
        currentTurn$,
        provisional$,
        lastHeard$,
        events$,
      };
      return observables;
    },
    methods: ({ observables }) => {
      const { append, provisional, stop } = (
        observables.state$ as typeof observables.state$ & { [controlKey]: Controls }
      )[controlKey];
      let timer: ReturnType<typeof setTimeout> | undefined;
      let closed = false;
      let livePending = false;
      const cancelTimer = () => {
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
      };
      const publish = (event: TranscriptEvent) => {
        if (event.type === 'provisional') provisional.next(event);
        else append(event);
        const mapped = forward?.createEvent(event);
        if (mapped !== undefined) forward?.emitEvent(mapped);
      };
      const clearProvisional = () => {
        if (observables.provisional$.get() !== undefined)
          publish({ type: 'provisional', text: undefined });
      };
      const flush = () => {
        if (closed) return;
        cancelTimer();
        const current = observables.currentTurn$.get();
        if (current) publish({ type: 'turn', turn: current });
        livePending = false;
        clearProvisional();
      };
      const subscription = observables.events$.subscribe(event => {
        if (event.type === 'reset' || event.type === 'turn') {
          cancelTimer();
          livePending = false;
        }
      });
      return {
        reset: () => {
          if (closed) return;
          publish({ type: 'reset' });
        },
        updateProvisional: (text: string) => {
          if (!closed) publish({ type: 'provisional', text: text.trim() || undefined });
        },
        ingestSegment: (segment: TranscriptSegment) => {
          if (closed) return;
          if (
            observables.segments$.get().some(existing => identity(existing) === identity(segment))
          )
            return;
          const text = segment.text.trim();
          if (!text) return;
          validateRecord({ type: 'segment', segment });
          const current = observables.currentTurn$.get();
          if (current && boundary(current, segment, turnSilenceMs)) flush();
          clearProvisional();
          publish({ type: 'segment', segment: { ...segment, text } });
          livePending = true;
          cancelTimer();
          timer = setTimeout(flush, turnSilenceMs);
        },
        /** Explicitly finalize even a hydrated pending turn; no-op after close. */
        flush,
        /** Flush live input only, then release timers/readers. Host stops and drains its sources first. */
        close: () => {
          if (closed) return;
          if (livePending) flush();
          else clearProvisional();
          cancelTimer();
          closed = true;
          subscription.unsubscribe();
          stop.next();
          stop.complete();
          provisional.complete();
        },
      };
    },
  });
};

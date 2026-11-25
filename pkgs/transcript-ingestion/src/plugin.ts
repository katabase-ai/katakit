import {
  EventLogPlugin,
  makeKatakitPlugin,
  optionalProperty,
  property,
  skipReplay,
} from '@katakit/core';
import type { ProvisionalUtterance, Utterance } from './events';
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
 * Connect to a caller-owned core EventLogPlugin runtime. The stream must replay its
 * complete ordered history synchronously; emitEvent must validate and publish synchronously.
 * Validate restored history before constructing the runtime. Mappings must round-trip
 * all recorded variants; return undefined only for unrelated host events.
 */
export type TranscriptEventLog<TEvent, TInput = TEvent> = {
  events$: Observable<TEvent>;
  emitEvent: (event: TInput) => void;
  toEvent: (event: TranscriptRecordedEvent) => TInput;
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

/** Map canonical records to core-log payloads. Core adds metadata only on live emission. */
export const toTranscriptIngestionEvent = (event: TranscriptRecordedEvent) => {
  validateRecord(event);
  switch (event.type) {
    case 'segment':
      return { ...event.segment, type: 'utteranceAdded' as const };
    case 'turn':
      return { ...event.turn, type: 'conversationTurnAdded' as const };
    case 'reset':
      return { type: 'transcriptReset' as const };
  }
};

/**
 * Validate/map core transcript payloads, ignoring unrelated records and legacy provisional
 * records. Legacy utterances/turns without sourceId use the stable source `default`.
 * The host separately validates metadata and other application event variants.
 */
export const fromTranscriptIngestionEvent = (
  value: unknown
): TranscriptRecordedEvent | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const event = value as Record<string, unknown>;
  if (event.type === 'transcriptReset') return { type: 'reset' };
  if (event.type !== 'utteranceAdded' && event.type !== 'conversationTurnAdded') return undefined;
  const content = {
    id: event.id,
    sourceId: event.sourceId === undefined ? 'default' : event.sourceId,
    text: event.text,
    ...(event.speaker === undefined ? {} : { speaker: event.speaker }),
    ...(event.startMs === undefined ? {} : { startMs: event.startMs }),
    ...(event.endMs === undefined ? {} : { endMs: event.endMs }),
  };
  return parseTranscriptRecordedEvent(
    event.type === 'utteranceAdded'
      ? { type: 'segment', segment: content }
      : { type: 'turn', turn: content }
  );
};
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
 * runtime's built-in core EventLogPlugin is the content authority.
 * Only live ingest starts silence timers. close drains live pending input, cancels the
 * timer and releases this plugin's subscriptions; it does not stop host audio or the log.
 */
export const makeTranscriptIngestionPlugin = <TEvent = never, TInput = TEvent>({
  turnSilenceMs = 1400,
  eventLog,
  forward,
}: {
  turnSilenceMs?: number;
  eventLog?: TranscriptEventLog<TEvent, TInput>;
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
    append: ((event: TranscriptRecordedEvent) => void) | undefined;
    provisional: Subject<Extract<TranscriptEvent, { type: 'provisional' }>>;
    provisionalUtterance: Subject<ProvisionalUtterance | null>;
    stop: Subject<void>;
  };
  return makeKatakitPlugin({
    type: 'TranscriptIngestion',
    configure: (_options: {}) => ({}),
    observables: ({ getObservables }) => {
      const source$ = eventLog
        ? eventLog.events$.pipe(
            map(eventLog.fromEvent),
            filter((event): event is TranscriptRecordedEvent => event !== undefined),
            map(validateRecord)
          )
        : getObservables(EventLogPlugin).events$.pipe(
            map(fromTranscriptIngestionEvent),
            filter((event): event is TranscriptRecordedEvent => event !== undefined)
          );
      const records$ = new Observable<TranscriptRecordedEvent>(subscriber =>
        source$.subscribe(subscriber)
      );
      const append = eventLog
        ? (event: TranscriptRecordedEvent) => eventLog.emitEvent(eventLog.toEvent(event))
        : undefined;
      const stop = new ReplaySubject<void>(1);
      const provisional = new Subject<Extract<TranscriptEvent, { type: 'provisional' }>>();
      const provisionalUtterance = new Subject<ProvisionalUtterance | null>();
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
            skipReplay(),
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
      const provisionalUtterance$ = property(
        merge(
          provisionalUtterance,
          provisional.pipe(
            filter(event => event.text === undefined),
            map(() => null)
          ),
          records$.pipe(
            skipReplay(),
            map(() => null)
          )
        ).pipe(startWith(null), takeUntil(stop), shareReplay({ bufferSize: 1, refCount: true }))
      );
      const pendingConversationTurn$ = property(
        state$.pipe(map(state => state.currentTurn ?? null))
      );
      const utterances$ = records$.pipe(
        filter(event => event.type === 'segment'),
        map(event => event.segment),
        takeUntil(stop)
      );
      const conversationTurnEvents$ = records$.pipe(
        filter(event => event.type === 'turn'),
        map(event => event.turn),
        takeUntil(stop)
      );
      // Recorder wrappers proxy streams but replace the observable collection.
      Object.defineProperty(state$, controlKey, {
        value: { append, provisional, provisionalUtterance, stop },
      });
      const observables = {
        state$,
        segments$,
        conversationTurns$,
        currentTurn$,
        provisional$,
        lastHeard$,
        events$,
        utterances$,
        collectedUtterances$: segments$,
        collectedConversationTurns$: conversationTurns$,
        conversationTurnEvents$,
        pendingConversationTurn$,
        provisionalUtterance$,
        provisionalUtterances$: provisionalUtterance$.pipe(
          filter((value): value is ProvisionalUtterance => value !== null)
        ),
      };
      return observables;
    },
    methods: ({ observables, getMethods }) => {
      const {
        append: mappedAppend,
        provisional,
        provisionalUtterance,
        stop,
      } = (observables.state$ as typeof observables.state$ & { [controlKey]: Controls })[
        controlKey
      ];
      const append =
        mappedAppend ??
        ((event: TranscriptRecordedEvent) =>
          getMethods(EventLogPlugin).emitEvent(toTranscriptIngestionEvent(event)));
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
      const ingestSegment = (segment: TranscriptSegment) => {
        if (closed) return;
        if (observables.segments$.get().some(existing => identity(existing) === identity(segment)))
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
      };
      const updateProvisionalUtterance = (utterance: ProvisionalUtterance) => {
        if (closed) return;
        const text = utterance.text.trim();
        publish({ type: 'provisional', text: text || undefined });
        provisionalUtterance.next(text ? { ...utterance, text } : null);
      };
      return {
        reset: () => {
          if (closed) return;
          publish({ type: 'reset' });
        },
        updateProvisional: (text: string) => {
          updateProvisionalUtterance({ text });
        },
        ingestSegment,
        /** Accept the core utterance shape; omitted sourceId uses the stable `default` source. */
        ingestUtterance: (utterance: Utterance) =>
          ingestSegment({ ...utterance, sourceId: utterance.sourceId ?? 'default' }),
        /** Provisional speaker/text are transient and are never recorded. */
        updateProvisionalUtterance,
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
          provisionalUtterance.complete();
        },
      };
    },
  });
};

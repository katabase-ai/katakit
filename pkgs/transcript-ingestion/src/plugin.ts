import { makeKatakitPlugin, optionalProperty, property } from '@katakit/core';
import { Subject, distinctUntilChanged, filter, map, scan, shareReplay, startWith } from 'rxjs';

/** IDs identify one finalized source line, so retransmission cannot duplicate a turn. */
export type TranscriptSegment = {
  id: string;
  sourceId: string;
  text: string;
  speaker?: string;
  startMs?: number;
  endMs?: number;
};

export type TranscriptTurn = {
  id: string;
  sourceId: string;
  text: string;
  speaker?: string;
  startMs?: number;
  endMs?: number;
};

/** Provisional updates are transient; only finalized segments and turns need forwarding. */
export type TranscriptEvent =
  | { type: 'provisional'; text: string | undefined }
  | { type: 'segment'; segment: TranscriptSegment }
  | { type: 'turn'; turn: TranscriptTurn }
  | { type: 'reset' };

export const makeTranscriptIngestionPlugin = <TEvent = never>({
  turnSilenceMs = 1400,
  forward,
}: {
  turnSilenceMs?: number;
  /** Map and forward selected local events into a host-owned event log or other sink. */
  forward?: {
    createEvent: (event: TranscriptEvent) => TEvent | undefined;
    emitEvent: (event: TEvent) => void;
  };
} = {}) => {
  if (!Number.isFinite(turnSilenceMs) || turnSilenceMs < 0) {
    throw new Error('turnSilenceMs must be a nonnegative number');
  }

  return makeKatakitPlugin({
    type: 'TranscriptIngestion',
    configure: (_options: {}) => ({ events: new Subject<TranscriptEvent>() }),
    observables: ({ options }) => {
      const events$ = options.events.asObservable();
      const conversationTurns$ = property(
        events$.pipe(
          filter(
            (event): event is Extract<TranscriptEvent, { type: 'turn' | 'reset' }> =>
              event.type === 'turn' || event.type === 'reset'
          ),
          scan(
            (turns: TranscriptTurn[], event) =>
              event.type === 'reset' ? [] : [...turns, event.turn],
            []
          ),
          startWith([] as TranscriptTurn[]),
          shareReplay({ bufferSize: 1, refCount: true })
        )
      );
      const currentTurn$ = optionalProperty(
        events$.pipe(
          scan(
            (current: TranscriptTurn | undefined, event): TranscriptTurn | undefined => {
              if (event.type === 'turn' || event.type === 'reset') return undefined;
              if (event.type !== 'segment') return current;
              const segment = event.segment;
              return current
                ? {
                    ...current,
                    text: `${current.text} ${segment.text}`,
                    endMs: segment.endMs ?? current.endMs,
                  }
                : {
                    id: `${segment.sourceId}\0${segment.id}`,
                    sourceId: segment.sourceId,
                    speaker: segment.speaker,
                    text: segment.text,
                    startMs: segment.startMs,
                    endMs: segment.endMs,
                  };
            },
            undefined as TranscriptTurn | undefined
          ),
          startWith(undefined),
          shareReplay({ bufferSize: 1, refCount: true })
        )
      );
      const provisional$ = optionalProperty(
        events$.pipe(
          filter(
            (event): event is Extract<TranscriptEvent, { type: 'provisional' | 'reset' }> =>
              event.type === 'provisional' || event.type === 'reset'
          ),
          scan(
            (_, event) => (event.type === 'reset' ? undefined : event.text),
            undefined as string | undefined
          ),
          startWith(undefined),
          shareReplay({ bufferSize: 1, refCount: true })
        )
      );
      const lastHeard$ = optionalProperty(
        events$.pipe(
          filter(event => event.type !== 'provisional'),
          map(() => currentTurn$.get()?.text ?? conversationTurns$.get().at(-1)?.text),
          startWith(undefined as string | undefined),
          distinctUntilChanged(),
          shareReplay({ bufferSize: 1, refCount: true })
        )
      );
      return { events$, conversationTurns$, currentTurn$, provisional$, lastHeard$ };
    },
    methods: ({ options, observables }) => {
      const { currentTurn$, provisional$ } = observables;
      const seen = new Set<string>();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let closed = false;

      const publish = (event: TranscriptEvent) => {
        // Keep the local stream synchronous for low-latency consumers.
        options.events.next(event);
        const mapped = forward?.createEvent(event);
        if (mapped !== undefined) forward?.emitEvent(mapped);
      };
      const clearProvisional = () => {
        if (provisional$.get() !== undefined) publish({ type: 'provisional', text: undefined });
      };
      const flush = () => {
        if (timer) clearTimeout(timer);
        timer = undefined;
        const current = currentTurn$.get();
        if (current) publish({ type: 'turn', turn: current });
        clearProvisional();
      };
      const schedule = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, turnSilenceMs);
      };

      return {
        reset: () => {
          if (closed) return;
          if (timer) clearTimeout(timer);
          timer = undefined;
          seen.clear();
          publish({ type: 'reset' });
        },
        updateProvisional: (text: string) => {
          if (!closed) publish({ type: 'provisional', text: text.trim() || undefined });
        },
        ingestSegment: (segment: TranscriptSegment) => {
          if (closed) return;
          const key = `${segment.sourceId}\0${segment.id}`;
          if (seen.has(key)) return;
          const text = segment.text.trim();
          if (!text) return;

          const current = currentTurn$.get();
          if (
            current &&
            (current.sourceId !== segment.sourceId ||
              current.speaker !== segment.speaker ||
              (segment.startMs !== undefined &&
                current.endMs !== undefined &&
                segment.startMs - current.endMs > turnSilenceMs))
          ) {
            flush();
          }
          seen.add(key);
          clearProvisional();
          publish({ type: 'segment', segment: { ...segment, text } });
          schedule();
        },
        flush,
        /** Stop the plugin's timer; the host must stop its audio source separately. */
        close: () => {
          if (closed) return;
          flush();
          closed = true;
          options.events.complete();
        },
      };
    },
  });
};

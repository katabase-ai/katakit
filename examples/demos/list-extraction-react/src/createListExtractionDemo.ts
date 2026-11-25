import { makeKatakit, property } from '@katakit/core';
import { makeEventLogPlugin } from '@katakit/event-log';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import { combineLatest, map, shareReplay, startWith, Subject, takeUntil } from 'rxjs';
import * as v from 'valibot';
import {
  ExtractionEventSchema,
  makeExtractionPlugin,
  type ExtractionEvent,
} from './extractionPlugin';
import {
  createExtractionRequest,
  ExtractionError,
  readExtraction,
  RulesSchema,
  toMarkdown,
  type ExtractionConnect,
  type ListRule,
} from './extractionModel';
import { sampleItems, sampleTurns } from './sample';

type RequestState = { phase: 'idle' | 'connecting' | 'extracting'; error?: ExtractionError };

/** One visit owns its transcript, event projections, admission, and cancellable on-demand request. */
export const createListExtractionDemo = ({
  initialEvents = [],
}: { initialEvents?: unknown } = {}) => {
  // EventLog deliberately trusts initial history; validate before starting any resources.
  const history = v.parse(v.array(ExtractionEventSchema), initialEvents);
  const EventLog = makeEventLogPlugin({ validateEvent: ExtractionEventSchema });
  const extraction = makeExtractionPlugin(EventLog);
  const kit = makeKatakit({
    plugins: [EventLog.configure({ initialEvents: history }), extraction.configure({})],
  }).start();
  const transcript = makeTranscriptIngestionPlugin<ExtractionEvent>({
    eventLog: {
      events$: kit.getObservables(EventLog).events$,
      emitEvent: kit.getMethods(EventLog).emitEvent,
      toEvent: event => {
        switch (event.type) {
          case 'segment':
            return { type: 'transcriptSegment', segment: event.segment };
          case 'turn':
            return { type: 'transcriptTurn', turn: event.turn };
          case 'reset':
            return { type: 'sessionCleared' };
        }
      },
      fromEvent: event => {
        switch (event.type) {
          case 'transcriptSegment':
            return { type: 'segment', segment: event.segment };
          case 'transcriptTurn':
            return { type: 'turn', turn: event.turn };
          case 'sessionCleared':
            return { type: 'reset' };
          default:
            return undefined;
        }
      },
    },
  });
  const transcriptKit = makeKatakit({ plugins: [transcript.configure({})] }).start();
  const input = transcriptKit.getMethods(transcript);
  const logged = kit.getMethods(extraction);
  const { content$: extractionContent$ } = kit.getObservables(extraction);
  const {
    state$: transcriptState$,
    currentTurn$,
    provisional$,
  } = transcriptKit.getObservables(transcript);
  const closed$ = new Subject<void>();
  // Use ingestion's canonical log projection for every transcript consumer, including extraction.
  const content$ = property(
    combineLatest([extractionContent$, transcriptState$]).pipe(
      map(([content, transcript]) => ({
        ...content,
        turns: transcript.conversationTurns,
        current: transcript.currentTurn,
      })),
      takeUntil(closed$),
      shareReplay({ bufferSize: 1, refCount: true })
    )
  );
  const requests = new Subject<RequestState>();
  const request$ = property(
    requests.pipe(
      startWith<RequestState>({ phase: 'idle' }),
      takeUntil(closed$),
      shareReplay({ bufferSize: 1, refCount: true })
    )
  );
  const state$ = property(
    combineLatest([content$, provisional$, request$]).pipe(
      map(([content, provisional, request]) => ({
        ...content,
        provisional,
        request,
        stale:
          !!content.result &&
          (JSON.stringify(content.rules) !== JSON.stringify(content.result.rules) ||
            JSON.stringify(content.turns.map(turn => turn.id)) !==
              JSON.stringify(content.result.turnIds)),
        markdown: content.result
          ? toMarkdown(content.result.rules, content.result.items, content.turns)
          : '',
      })),
      takeUntil(closed$),
      shareReplay({ bufferSize: 1, refCount: true })
    )
  );
  let closed = false;
  let active: AbortController | undefined;
  const cancel = (resetFailure = false) => {
    active?.abort();
    active = undefined;
    if (!closed)
      requests.next({ phase: 'idle', error: resetFailure ? undefined : request$.get().error });
  };
  return {
    state$,
    events$: kit.getObservables(EventLog).events$,
    ingestSegment: (segment: Parameters<typeof input.ingestSegment>[0]) => {
      if (closed) return;
      if (active && segment.text.trim()) cancel();
      input.ingestSegment(segment);
    },
    updateProvisional: (text: string) => {
      if (closed) return;
      if (active && text.trim()) cancel();
      input.updateProvisional(text);
    },
    flush: input.flush,
    cancel,
    setRules: (next: ListRule[]) => {
      if (closed) return;
      const rules = v.parse(RulesSchema, next);
      if (new Set(rules.map(rule => rule.id)).size !== rules.length)
        throw new Error('List IDs must be unique.');
      cancel();
      logged.record({ type: 'rulesChanged', rules });
    },
    edit: (id: string, text: string) => {
      if (closed || !content$.get().result?.items.some(item => item.id === id)) return;
      cancel();
      logged.record(v.parse(ExtractionEventSchema, { type: 'itemEdited', id, text }));
    },
    setHidden: (id: string, hidden: boolean) => {
      if (!closed && content$.get().result?.items.some(item => item.id === id)) {
        cancel();
        logged.record({ type: 'visibilityChanged', id, hidden });
      }
    },
    clear: () => {
      if (closed) return;
      cancel();
      input.reset();
    },
    loadSample: () => {
      if (
        closed ||
        content$.get().turns.some(turn => turn.sourceId !== 'sample') ||
        currentTurn$.get() ||
        provisional$.get()
      )
        return;
      cancel();
      if (!content$.get().turns.length)
        for (const turn of sampleTurns) logged.record({ type: 'transcriptTurn', turn });
      const { rules } = content$.get();
      logged.record({
        type: 'extracted',
        rules,
        items: sampleItems(rules),
        turnIds: sampleTurns.map(turn => turn.id),
        sample: true,
      });
    },
    extract: async (connect: ExtractionConnect) => {
      if (closed || active || request$.get().error?.policy.terminal) return;
      input.flush();
      const { rules, turns } = content$.get();
      if (!turns.length) return;
      const controller = new AbortController();
      active = controller;
      const valid = () => !closed && active === controller && !controller.signal.aborted;
      let connection: Awaited<ReturnType<ExtractionConnect>> | undefined;
      let sent = false;
      requests.next({ phase: 'connecting' });
      try {
        connection = await connect({ signal: controller.signal });
        if (!valid()) return;
        const body = createExtractionRequest(rules, turns, connection);
        requests.next({ phase: 'extracting' });
        sent = true;
        const response = await connection.requestCompletion({ body, signal: controller.signal });
        if (!valid()) return;
        const items = readExtraction(response, rules, turns);
        logged.record({
          type: 'extracted',
          rules,
          items,
          turnIds: turns.map(turn => turn.id),
          sample: false,
        });
        requests.next({ phase: 'idle' });
      } catch (error) {
        if (!valid()) return;
        const failure =
          error instanceof ExtractionError
            ? error
            : new ExtractionError('The lists could not be extracted. Try again.');
        if (sent) {
          try {
            connection?.reportFailure?.(failure);
          } catch {
            /* Diagnostics cannot keep the request busy. */
          }
        }
        requests.next({ phase: 'idle', error: failure });
      } finally {
        if (active === controller) active = undefined;
      }
    },
    close: () => {
      if (closed) return;
      cancel();
      closed = true;
      input.close();
      logged.close();
      closed$.next();
      closed$.complete();
      requests.complete();
    },
  };
};

export type ListExtractionRuntime = ReturnType<typeof createListExtractionDemo>;

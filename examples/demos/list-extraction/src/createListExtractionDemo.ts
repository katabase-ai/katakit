import { EventLogPlugin, makeKatakit, property } from '@katakit/core';
import {
  BehaviorSubject,
  combineLatest,
  map,
  shareReplay,
  startWith,
  Subject,
  switchMap,
  takeUntil,
} from 'rxjs';
import { createTranscriptInput, type SourceSegment } from './transcriptInput';
import * as v from 'valibot';
import {
  ExtractionEventSchema,
  makeExtractionPlugin,
  readExtractionEvent,
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
}: { initialEvents?: unknown[] } = {}) => {
  const extraction = makeExtractionPlugin();
  const history = initialEvents.map(readExtractionEvent);
  if (history.some((event, index) => event.meta.seq !== index))
    throw new Error('Extraction history must be ordered and complete.');
  const kit = makeKatakit({
    existingEvents: history,
    plugins: [extraction.configure({})],
  }).start();
  const inputs = new BehaviorSubject(createTranscriptInput());
  const logged = kit.getMethods(extraction);
  const { content$ } = kit.getObservables(extraction);
  const turns = inputs
    .pipe(switchMap(input => input.turns$))
    .subscribe(turn => logged.record({ type: 'transcriptTurn', turn }));
  const currentTurn$ = inputs.pipe(switchMap(input => input.currentTurn$));
  const provisional$ = inputs.pipe(switchMap(input => input.provisional$));
  const closed$ = new Subject<void>();
  const requests = new Subject<RequestState>();
  const request$ = property(
    requests.pipe(
      startWith<RequestState>({ phase: 'idle' }),
      takeUntil(closed$),
      shareReplay({ bufferSize: 1, refCount: true })
    )
  );
  const state$ = property(
    combineLatest([content$, currentTurn$, provisional$, request$]).pipe(
      map(([content, current, provisional, request]) => ({
        ...content,
        current,
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
    events$: kit.getObservables(EventLogPlugin).events$,
    ingestSegment: (segment: SourceSegment) => {
      if (closed) return;
      if (active && segment.text.trim()) cancel();
      inputs.value.ingestSegment(segment);
    },
    updateProvisional: (text: string) => {
      if (closed) return;
      if (active && text.trim()) cancel();
      inputs.value.updateProvisional(text);
    },
    flush: () => inputs.value.flush(),
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
      inputs.value.close();
      inputs.next(createTranscriptInput());
      logged.record({ type: 'sessionCleared' });
    },
    loadSample: () => {
      if (
        closed ||
        content$.get().turns.some(turn => turn.sourceId !== 'sample') ||
        state$.get().current ||
        state$.get().provisional
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
      inputs.value.flush();
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
      inputs.value.close();
      turns.unsubscribe();
      inputs.complete();
      logged.close();
      closed$.next();
      closed$.complete();
      requests.complete();
    },
  };
};

export type ListExtractionRuntime = ReturnType<typeof createListExtractionDemo>;

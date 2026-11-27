import { EventLogPlugin, makeEffect, makeKatakitPlugin, property } from '@katakit/core';
import type { TranscriptionSegment } from '@katakit/transcription';
import * as v from 'valibot';
import { delay } from 'es-toolkit';
import {
  combineLatest,
  distinctUntilChanged,
  map,
  merge,
  scan,
  shareReplay,
  startWith,
  Subject,
  takeUntil,
} from 'rxjs';
import { match } from 'ts-pattern';
import { applyNotesResult } from './applyNotesResult';
import { NotesEventSchema, readNotesEvent, type NotesEvent } from './notesEvents';
import {
  createNotesRequest,
  NotesRequestError,
  parseNotesCompletion,
  type Note,
  type NotesConnection,
} from './notesModel';

/** A failed request is tried again on its own this many times before notes pause. */
const DEFAULT_RETRY_LIMIT = 2;
const DEFAULT_RETRY_AFTER_MS = 300;

type RequestState =
  | { status: 'idle' | 'requesting'; failure?: never }
  | { status: 'waiting' | 'paused'; failure: NotesRequestError };

/** The log owns content. Connections, cancellation and retry state belong to this live visit. */
export const makeNotesPlugin = () =>
  makeKatakitPlugin({
    type: 'Notes',
    configure: (_options: {}) => ({
      request: new Subject<RequestState>(),
      retry: new Subject<void>(),
      closed: new Subject<void>(),
    }),
    observables: ({ options, getObservables }) => {
      const initial: { notes: Note[]; turns: TranscriptionSegment[]; cursor: number } = {
        notes: [],
        turns: [],
        cursor: 0,
      };
      const content$ = property(
        getObservables(EventLogPlugin).events$.pipe(
          map(readNotesEvent),
          scan(
            (content, event) =>
              match(event)
                .with({ type: 'transcriptTurn' }, ({ turn }) => ({
                  ...content,
                  turns: [...content.turns, turn],
                }))
                .with({ type: 'notesUpdated' }, ({ notes, cursor }) => ({
                  ...content,
                  notes,
                  cursor,
                }))
                .with({ type: 'notesCleared' }, ({ cursor }) => ({ ...content, notes: [], cursor }))
                .exhaustive(),
            initial
          ),
          startWith(initial),
          takeUntil(options.closed),
          shareReplay({ bufferSize: 1, refCount: true })
        )
      );
      const request$ = options.request.pipe(startWith<RequestState>({ status: 'idle' }));
      const state$ = property(
        combineLatest([content$, request$]).pipe(
          map(([content, request]) => ({
            ...content,
            ...request,
            pendingTurnCount: content.turns.length - content.cursor,
          })),
          takeUntil(options.closed),
          shareReplay({ bufferSize: 1, refCount: true })
        )
      );
      const markdown$ = property(
        content$.pipe(
          map(({ notes }) =>
            notes
              .flatMap(note => [
                `- ${note.text.replaceAll('\n', '\n  ')}`,
                ...note.children.map(child => `  - ${child.text.replaceAll('\n', '\n    ')}`),
              ])
              .join('\n')
          ),
          distinctUntilChanged(),
          takeUntil(options.closed),
          shareReplay({ bufferSize: 1, refCount: true })
        )
      );
      return { content$, state$, markdown$ };
    },
    methods: ({ options, observables, getMethods }) => {
      const { content$, state$ } = observables;
      const log = getMethods(EventLogPlugin);
      const emitEvent = (event: NotesEvent) => log.emitEvent(v.parse(NotesEventSchema, event));
      let connection: NotesConnection | undefined;
      let controller: AbortController | undefined;
      let closed = false;
      return {
        recordTurn: (turn: TranscriptionSegment) => emitEvent({ type: 'transcriptTurn', turn }),
        connect: (next: NotesConnection) => {
          if (closed) return;
          controller?.abort();
          connection = next;
          options.request.next({ status: 'idle' });
          options.retry.next();
        },
        pause: () => {
          if (closed) return;
          controller?.abort();
          connection = undefined;
          options.request.next({ status: 'idle' });
        },
        retry: () => {
          if (closed || state$.get().failure?.policy.terminal) return;
          options.request.next({ status: 'idle' });
          options.retry.next();
        },
        clear: () => {
          if (closed) return;
          controller?.abort();
          const failure = state$.get().failure;
          const keepPaused = failure?.policy.terminal && !failure.policy.clearable;
          emitEvent({ type: 'notesCleared', cursor: content$.get().turns.length });
          options.request.next(keepPaused ? { status: 'paused', failure } : { status: 'idle' });
        },
        close: () => {
          if (closed) return;
          closed = true;
          controller?.abort();
          options.closed.next();
          options.closed.complete();
          options.retry.complete();
          options.request.complete();
        },
        process: async () => {
          if (closed || !connection || state$.get().status === 'paused') return;
          const activeConnection = connection;
          const abort = new AbortController();
          controller = abort;
          let retries = 0;
          while (!abort.signal.aborted && state$.get().pendingTurnCount > 0) {
            let requestStarted = false;
            try {
              options.request.next({ status: 'requesting' });
              const content = content$.get();
              const request = createNotesRequest({ ...content, connection: activeConnection });
              requestStarted = true;
              const completion = await activeConnection.requestCompletion({
                body: request.body,
                signal: abort.signal,
              });
              if (closed || abort.signal.aborted) return;
              const notes = applyNotesResult({
                notes: content.notes,
                response: parseNotesCompletion(completion),
              });
              emitEvent({ type: 'notesUpdated', notes, cursor: request.end });
              retries = 0;
              options.request.next({ status: 'idle' });
            } catch (error) {
              if (closed || abort.signal.aborted) return;
              const failure =
                error instanceof NotesRequestError
                  ? error
                  : new NotesRequestError('Notes could not be updated.');
              // Local sizing failures have no transport request to correlate.
              if (requestStarted) activeConnection.reportFailure?.(failure);
              const {
                retryAfterMs = DEFAULT_RETRY_AFTER_MS,
                retryLimit = DEFAULT_RETRY_LIMIT,
                terminal,
                restart,
              } = failure.policy;
              if (terminal || restart || retries >= retryLimit) {
                options.request.next({ status: 'paused', failure });
                return;
              }
              retries++;
              options.request.next({ status: 'waiting', failure });
              try {
                await delay(retryAfterMs, { signal: abort.signal });
              } catch {
                // The delay rejects when clear or close aborts this visit's request.
                return;
              }
            }
          }
        },
      };
    },
    effects: ({ options, methods, observables }) => [
      makeEffect({
        on: merge(observables.content$, options.retry).pipe(takeUntil(options.closed)),
        backpressure: 'latest',
        handler: methods.process,
      }),
    ],
  });

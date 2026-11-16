import { makeEffect, makeKatakitPlugin, property } from '@katakit/core';
import type { makeEventLogPlugin } from '@katakit/event-log';
import type { TranscriptTurn } from '@katakit/transcript-ingestion';
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
import * as v from 'valibot';
import type { NotesEvent } from './notesEvents';
import {
  createNotesRequest,
  NotesRequestError,
  NotesResultSchema,
  type Note,
  type NotesConnection,
} from './notesModel';

type RequestState = {
  status: 'idle' | 'requesting' | 'waiting' | 'paused';
  failure?: NotesRequestError;
};

/** The log owns content. Connections, cancellation and retry state belong to this live visit. */
export const makeNotesPlugin = ({
  EventLogPlugin,
}: {
  EventLogPlugin: ReturnType<typeof makeEventLogPlugin<NotesEvent>>;
}) =>
  makeKatakitPlugin({
    type: 'Notes',
    configure: (_options: {}) => ({
      request: new Subject<RequestState>(),
      retry: new Subject<void>(),
      closed: new Subject<void>(),
    }),
    observables: ({ options, getObservables }) => {
      const initial = { notes: [] as Note[], turns: [] as TranscriptTurn[], cursor: 0 };
      const content$ = property(
        getObservables(EventLogPlugin).events$.pipe(
          scan((content, event) => {
            if (event.type === 'transcriptTurn')
              return { ...content, turns: [...content.turns, event.turn] };
            return {
              ...content,
              notes: event.type === 'notesCleared' ? [] : event.notes,
              cursor: event.cursor,
            };
          }, initial),
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
      const { emitEvent } = getMethods(EventLogPlugin);
      let connection: NotesConnection | undefined;
      let controller: AbortController | undefined;
      let closed = false;
      return {
        connect: (next: NotesConnection) => {
          if (closed) return;
          connection = next;
          options.request.next({ status: 'idle' });
          options.retry.next();
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
              const response = await activeConnection.requestNotes({
                body: request.body,
                signal: abort.signal,
              });
              if (closed || abort.signal.aborted) return;
              const parsed = v.safeParse(NotesResultSchema, response);
              if (!parsed.success)
                throw new NotesRequestError('The model returned invalid notes. Try again.', {
                  code: 'notes_schema',
                });
              const { additions, rewords } = parsed.output;
              // Reject the whole update before recording anything or consuming its turns.
              if (
                additions.some(
                  addition =>
                    addition.underId !== undefined &&
                    !content.notes.some(note => note.id === addition.underId)
                ) ||
                rewords.some(
                  change =>
                    !content.notes.some(
                      note =>
                        note.id === change.id || note.children.some(child => child.id === change.id)
                    )
                )
              )
                throw new NotesRequestError('The model referred to a missing note. Try again.', {
                  code: 'notes_target',
                });
              const reword = (note: { id: string; text: string }) => ({
                ...note,
                text: rewords.find(change => change.id === note.id)?.text ?? note.text,
              });
              const notes = content.notes.map(note => ({
                ...reword(note),
                children: note.children.map(reword),
              }));
              for (const addition of additions) {
                const item = { id: crypto.randomUUID(), text: addition.text };
                if (addition.underId === undefined) notes.push({ ...item, children: [] });
                else notes.find(note => note.id === addition.underId)!.children.push(item);
              }
              emitEvent({ type: 'notesUpdated', notes, cursor: request.end });
              retries = 0;
              options.request.next({ status: 'idle' });
            } catch (error) {
              if (closed || abort.signal.aborted) return;
              const failure =
                error instanceof NotesRequestError
                  ? error
                  : new NotesRequestError('Notes could not be updated. Try again.');
              // Local sizing failures have no transport request to correlate.
              if (requestStarted) activeConnection.reportFailure?.(failure);
              const { retryAfterMs, retryLimit = 0 } = failure.policy;
              if (retryAfterMs === undefined || retries++ >= retryLimit) {
                options.request.next({ status: 'paused', failure });
                return;
              }
              options.request.next({ status: 'waiting', failure });
              await new Promise<void>(resolve => {
                const finish = () => {
                  clearTimeout(timer);
                  abort.signal.removeEventListener('abort', finish);
                  resolve();
                };
                const timer = setTimeout(finish, retryAfterMs);
                abort.signal.addEventListener('abort', finish, { once: true });
              });
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

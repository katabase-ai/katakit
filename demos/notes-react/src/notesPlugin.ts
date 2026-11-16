import { makeEffect, makeKatakitPlugin, property } from '@katakit/core';
import type { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import { BehaviorSubject, merge, Subject, takeUntil } from 'rxjs';
import * as v from 'valibot';
import {
  createNotesRequest,
  NotesRequestError,
  NotesResultSchema,
  type Note,
  type NotesConnection,
} from './notesModel';

export type NotesState = {
  notes: Note[];
  pendingTurnCount: number;
  status: 'idle' | 'requesting' | 'waiting' | 'paused';
  failure?: NotesRequestError;
};

/** One in-flight model call owns the cursor. Clear/close invalidate its result before aborting it. */
export const makeNotesPlugin = ({
  TranscriptIngestionPlugin,
}: {
  TranscriptIngestionPlugin: ReturnType<typeof makeTranscriptIngestionPlugin>;
}) =>
  makeKatakitPlugin({
    type: 'Notes',
    configure: (_options: {}) => ({
      state: new BehaviorSubject<NotesState>({ notes: [], pendingTurnCount: 0, status: 'idle' }),
      retry: new Subject<void>(),
      closed: new Subject<void>(),
    }),
    observables: ({ options }) => ({ state$: property(options.state.asObservable()) }),
    methods: ({ options, getObservables }) => {
      const turns = getObservables(TranscriptIngestionPlugin).conversationTurns$;
      let connection: NotesConnection | undefined;
      let cursor = 0;
      let controller: AbortController | undefined;
      let closed = false;
      const update = (patch: Partial<NotesState>) =>
        options.state.next({
          ...options.state.value,
          pendingTurnCount: Math.max(0, turns.get().length - cursor),
          ...patch,
        });
      return {
        connect: (next: NotesConnection) => {
          connection = next;
          update({ status: 'idle', failure: undefined });
          options.retry.next();
        },
        retry: () => {
          if (options.state.value.failure?.policy.terminal) return;
          update({ status: 'idle', failure: undefined });
          options.retry.next();
        },
        clear: () => {
          controller?.abort();
          cursor = turns.get().length;
          const failure = options.state.value.failure;
          const keepPaused = failure?.policy.terminal && !failure.policy.clearable;
          update({
            notes: [],
            status: keepPaused ? 'paused' : 'idle',
            failure: keepPaused ? failure : undefined,
          });
        },
        close: () => {
          if (closed) return;
          closed = true;
          controller?.abort();
          options.closed.next();
          options.closed.complete();
          options.retry.complete();
          options.state.complete();
        },
        process: async () => {
          if (closed) return;
          update({});
          if (!connection || options.state.value.status === 'paused') return;
          const activeConnection = connection;
          const abort = new AbortController();
          controller = abort;
          let retries = 0;
          while (!abort.signal.aborted && cursor < turns.get().length) {
            try {
              update({ status: 'requesting', failure: undefined });
              const request = createNotesRequest({
                notes: options.state.value.notes,
                turns: turns.get(),
                cursor,
                connection: activeConnection,
              });
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
              // A missing target invalidates the whole update; never consume a turn we could not apply.
              if (
                additions.some(
                  addition =>
                    addition.underId !== undefined &&
                    !options.state.value.notes.some(note => note.id === addition.underId)
                ) ||
                rewords.some(
                  change =>
                    !options.state.value.notes.some(
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
              const notes = options.state.value.notes.map(note => ({
                ...reword(note),
                children: note.children.map(reword),
              }));
              for (const addition of additions) {
                const item = { id: crypto.randomUUID(), text: addition.text };
                if (addition.underId === undefined) notes.push({ ...item, children: [] });
                else notes.find(note => note.id === addition.underId)?.children.push(item);
              }
              cursor = request.end;
              retries = 0;
              update({ notes, status: 'idle' });
            } catch (error) {
              if (closed || abort.signal.aborted) return;
              const failure =
                error instanceof NotesRequestError
                  ? error
                  : new NotesRequestError('Notes could not be updated. Try again.');
              activeConnection.reportFailure?.(failure);
              const { retryAfterMs, retryLimit = 0 } = failure.policy;
              if (retryAfterMs === undefined || retries++ >= retryLimit) {
                update({ status: 'paused', failure });
                return;
              }
              update({ status: 'waiting', failure });
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
    effects: ({ options, methods, getObservables }) => [
      makeEffect({
        on: merge(getObservables(TranscriptIngestionPlugin).conversationTurns$, options.retry).pipe(
          takeUntil(options.closed)
        ),
        backpressure: 'latest',
        handler: methods.process,
      }),
    ],
  });

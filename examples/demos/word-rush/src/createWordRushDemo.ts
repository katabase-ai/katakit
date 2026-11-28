import { EventLogPlugin, makeKatakit, type KatakitEvent } from '@katakit/core';
import type { MicrophoneOptions } from '@katakit/transcription/browser';
import { BehaviorSubject, type Observable } from 'rxjs';
import { findChallenge } from './challenges';
import { WordRushPlugin, type WordRushContent } from './wordRushPlugin';
import {
  WordRushRequestError,
  createWordRushRequest,
  judgeWordRushCandidates,
  parseWordRushCompletion,
  requestWordRushModel,
  type WordRushConnection,
  type WordRushJudgment,
} from './wordRushModel';

export type { WordRushNote } from './events';
export type WordRushSnapshot = WordRushContent & {
  remaining: number | null;
  provisional: string;
  busy: boolean;
  connected: boolean;
  feedback: string;
  failure?: WordRushRequestError;
};

/** One visit owns its event log, single-flight judging queue, and round clock.
 * existingEvents is typed in-memory history; callers loading storage decode it first.
 */
export const createWordRushDemo = (existingEvents: KatakitEvent[] = []) => {
  // Restoring typed in-memory facts reconstructs content; no connection or clock is restored.
  const kit = makeKatakit({ plugins: [WordRushPlugin.configure({})], existingEvents }).start();
  const game = kit.getMethods(WordRushPlugin);
  const { content$ } = kit.getObservables(WordRushPlugin);
  const { events$ } = kit.getObservables(EventLogPlugin);
  let connection: WordRushConnection | undefined;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  let accepting = false;
  let generation = 0;
  const seen = new Set(
    events$
      .getAll()
      .filter(event => event.type === 'heard')
      .map(event => String(event.id))
  );
  let transient = {
    provisional: '',
    busy: false,
    connected: false,
    feedback: '',
  } as Omit<WordRushSnapshot, keyof WordRushContent | 'remaining'>;
  const snapshot = (): WordRushSnapshot => {
    const content = content$.get();
    return {
      ...structuredClone(content),
      ...transient,
      failure:
        transient.failure &&
        new WordRushRequestError(transient.failure.message, { ...transient.failure.policy }),
      remaining:
        content.deadline === null
          ? content.seconds
          : Math.max(0, Math.ceil((content.deadline - (content.endedAt ?? Date.now())) / 1000)),
    };
  };
  const state$ = new BehaviorSubject(snapshot());
  const publicState$ = Object.defineProperty(state$.asObservable(), 'value', {
    get: snapshot,
  }) as Observable<WordRushSnapshot> & { readonly value: WordRushSnapshot };
  const publish = () => {
    if (!closed) state$.next(snapshot());
  };
  const subscription = content$.subscribe(publish);
  const clearTimer = () => {
    clearInterval(timer);
    timer = undefined;
  };
  const cancelWork = () => {
    generation++;
    controller?.abort();
    controller = undefined;
    accepting = false;
    clearTimer();
    const failure =
      transient.failure?.policy.terminal && transient.failure.policy.code !== 'context_limit'
        ? transient.failure
        : undefined;
    transient = { ...transient, busy: false, provisional: '', failure };
  };
  const finish = () => {
    if (closed || content$.get().phase !== 'running') return;
    clearTimer();
    game.finishRound(Date.now());
  };
  const flush = () => {
    if (closed || !['running', 'finishing'].includes(content$.get().phase)) return;
    finish();
    accepting = false;
    transient.provisional = '';
    game.completeRound();
  };
  const accept = (judgments: WordRushJudgment[], cursor: number) => {
    const { accepted, qualified } = game.recordJudgments(judgments, cursor);
    transient.feedback = accepted
      ? `Added ${accepted} ${accepted === 1 ? 'answer' : 'answers'}.`
      : qualified
        ? 'Already on the board.'
        : 'No new qualifying answers.';
    publish();
  };
  const process = async () => {
    if (
      closed ||
      controller ||
      transient.failure ||
      !connection ||
      content$.get().cursor >= content$.get().segments.length
    )
      return;
    const currentGeneration = generation;
    const abort = new AbortController();
    const activeConnection = connection;
    controller = abort;
    transient.busy = true;
    publish();
    try {
      while (content$.get().cursor < content$.get().segments.length) {
        if (closed || generation !== currentGeneration || abort.signal.aborted) return;
        // Bound each request without discarding pending segments. New arrivals wait in order.
        const content = content$.get();
        let end = content.cursor;
        let text = '';
        while (
          end < content.segments.length &&
          (end === content.cursor || text.length + content.segments[end]!.text.length < 3000)
        ) {
          text += `${text ? '\n' : ''}${content.segments[end++]!.text}`;
        }
        const challenge = findChallenge(content.challengeId);
        const body = createWordRushRequest({
          existing: content.notes.map(note => note.text),
          removed: content.removed,
          text,
          connection: activeConnection!,
        });
        const completion = await requestWordRushModel(activeConnection.requestCompletion, {
          body,
          signal: abort.signal,
        });
        if (closed || generation !== currentGeneration || abort.signal.aborted) return;
        const candidates = parseWordRushCompletion(completion, text);
        if (closed || generation !== currentGeneration || abort.signal.aborted) return;
        const judgments = await judgeWordRushCandidates({
          candidates,
          challenge,
          text,
          connection: activeConnection,
          signal: abort.signal,
        });
        if (closed || generation !== currentGeneration || abort.signal.aborted) return;
        // Read the current board here: the player may have removed a note during the request.
        accept(judgments, end);
      }
    } catch (error) {
      if (closed || generation !== currentGeneration || abort.signal.aborted) return;
      transient.failure =
        error instanceof WordRushRequestError
          ? error
          : new WordRushRequestError('Judging is delayed. Try again.');
      activeConnection?.reportFailure?.(transient.failure);
    } finally {
      if (controller === abort) {
        controller = undefined;
        transient.busy = false;
        publish();
      }
    }
  };

  return {
    state$: publicState$,
    events$,
    configure: ({
      challengeId = content$.get().challengeId,
      seconds = content$.get().seconds,
    }: {
      challengeId?: string;
      seconds?: number | null;
    }) => {
      if (closed || ['running', 'finishing'].includes(content$.get().phase)) return;
      if (
        !findChallenge(challengeId) ||
        (seconds !== null && (!Number.isFinite(seconds) || seconds <= 0))
      )
        return;
      cancelWork();
      transient.feedback = '';
      game.configureRound(challengeId, seconds);
    },
    connect: (next: WordRushConnection) => {
      if (closed) return;
      if (connection && connection !== next) {
        // Explicit replacement cancels the old request before the new connection resumes pending input.
        generation++;
        controller?.abort();
        controller = undefined;
        transient.busy = false;
      }
      connection = next;
      transient.connected = true;
      transient.failure = undefined;
      publish();
      void process();
    },
    begin: () => {
      if (
        closed ||
        ['running', 'finishing'].includes(content$.get().phase) ||
        (content$.get().phase === 'finished' && transient.busy) ||
        !connection ||
        transient.failure?.policy.terminal
      )
        return;
      cancelWork();
      accepting = true;
      transient.feedback = '';
      const seconds = content$.get().seconds;
      game.startRound(crypto.randomUUID(), seconds === null ? null : Date.now() + seconds * 1000);
      if (content$.get().deadline !== null)
        timer = setInterval(() => {
          if (content$.get().deadline !== null && Date.now() >= content$.get().deadline!) finish();
          else publish();
        }, 200);
    },
    finish,
    flush,
    ingestSegment: (segment => {
      if (closed || !accepting || !segment.text.trim()) return;
      const key = `${segment.sourceId}:${segment.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      transient.provisional = '';
      // Preserve whole utterances, including answers spanning an arbitrary character boundary.
      // An oversized utterance pauses at the wire-size check rather than losing words.
      game.recordSegment(key, segment.text);
      void process();
    }) satisfies MicrophoneOptions['onFinal'],
    updateProvisional: (text: string) => {
      if (closed || !accepting) return;
      transient.provisional = text;
      publish();
    },
    remove: (id: string) => {
      if (!closed) game.removeNote(id);
    },
    retry: () => {
      if (closed || transient.failure?.policy.terminal) return;
      transient.failure = undefined;
      publish();
      void process();
    },
    disconnect: () => {
      if (closed) return;
      cancelWork();
      connection = undefined;
      transient.connected = false;
      transient.failure = undefined;
      // A changed host/mode must not resume an old connection or leave a stopped clock running.
      finish();
      publish();
    },
    cancelWork,
    close: () => {
      if (closed) return;
      cancelWork();
      closed = true;
      subscription.unsubscribe();
      state$.complete();
    },
  };
};

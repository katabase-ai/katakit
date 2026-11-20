import { makeKatakit } from '@katakit/core';
import { makeEventLogPlugin } from '@katakit/event-log';
import type { MicrophoneOptions } from '@katakit/transcription/browser';
import { BehaviorSubject } from 'rxjs';
import * as v from 'valibot';
import { answerKey, findChallenge } from './challenges';
import {
  BrainstormRequestError,
  createBrainstormRequest,
  matchPracticeAnswers,
  parseBrainstormCompletion,
  type BrainstormConnection,
  type JudgedAnswer,
} from './brainstormModel';

const NoteSchema = v.object({ id: v.string(), text: v.string(), evidence: v.string() });
const EventSchema = v.variant('type', [
  v.object({
    type: v.literal('configured'),
    challengeId: v.string(),
    seconds: v.nullable(v.number()),
  }),
  v.object({ type: v.literal('started'), roundId: v.string(), deadline: v.nullable(v.number()) }),
  v.object({ type: v.literal('heard'), id: v.string(), text: v.string() }),
  v.object({ type: v.literal('judged'), notes: v.array(NoteSchema), cursor: v.number() }),
  v.object({ type: v.literal('removed'), id: v.string() }),
  v.object({ type: v.literal('finishing'), at: v.number() }),
  v.object({ type: v.literal('finished') }),
]);
type GameEvent = v.InferOutput<typeof EventSchema>;
export type BrainstormNote = v.InferOutput<typeof NoteSchema>;
type Content = {
  roundId: string;
  challengeId: string;
  seconds: number | null;
  deadline: number | null;
  endedAt: number | null;
  phase: 'idle' | 'running' | 'finishing' | 'finished';
  notes: BrainstormNote[];
  removed: string[];
  segments: { id: string; text: string }[];
  cursor: number;
};
const initial = (): Content => ({
  roundId: '',
  challengeId: 'animals-01',
  seconds: 60,
  deadline: null,
  endedAt: null,
  phase: 'idle',
  notes: [],
  removed: [],
  segments: [],
  cursor: 0,
});

/** Board content is derived only from accepted events; clocks and requests are transient. */
const reduce = (state: Content, event: GameEvent): Content => {
  switch (event.type) {
    case 'configured':
      return { ...initial(), challengeId: event.challengeId, seconds: event.seconds };
    case 'started':
      return {
        ...initial(),
        challengeId: state.challengeId,
        seconds: state.seconds,
        roundId: event.roundId,
        deadline: event.deadline,
        phase: 'running',
      };
    case 'heard':
      return { ...state, segments: [...state.segments, { id: event.id, text: event.text }] };
    case 'judged':
      return { ...state, notes: [...state.notes, ...event.notes], cursor: event.cursor };
    case 'removed': {
      const note = state.notes.find(note => note.id === event.id);
      return note
        ? {
            ...state,
            notes: state.notes.filter(note => note.id !== event.id),
            removed: [...state.removed, note.text],
          }
        : state;
    }
    case 'finishing':
      return { ...state, phase: 'finishing', endedAt: event.at };
    case 'finished':
      return { ...state, phase: 'finished' };
  }
};

export type BrainstormSnapshot = Content & {
  remaining: number | null;
  provisional: string;
  busy: boolean;
  connected: boolean;
  practice: boolean;
  feedback: string;
  failure?: BrainstormRequestError;
};

/** One visit owns its event log, single-flight judging queue, and round clock. */
export const createBrainstormDemo = () => {
  const log = makeEventLogPlugin({ validateEvent: EventSchema });
  const kit = makeKatakit({ plugins: [log.configure({ initialEvents: [] })] }).start();
  const { emitEvent } = kit.getMethods(log);
  const { events$ } = kit.getObservables(log);
  let content = initial();
  let connection: BrainstormConnection | undefined;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  let accepting = false;
  let generation = 0;
  const seen = new Set<string>();
  let transient = {
    provisional: '',
    busy: false,
    connected: false,
    practice: false,
    feedback: '',
  } as Omit<BrainstormSnapshot, keyof Content | 'remaining'>;
  const snapshot = (): BrainstormSnapshot => ({
    ...content,
    ...transient,
    remaining:
      content.deadline === null
        ? content.seconds
        : Math.max(0, Math.ceil((content.deadline - (content.endedAt ?? Date.now())) / 1000)),
  });
  const state$ = new BehaviorSubject(snapshot());
  const publish = () => {
    if (!closed) state$.next(snapshot());
  };
  const subscription = events$.subscribe(event => {
    content = reduce(content, event);
    publish();
  });
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
    if (closed || content.phase !== 'running') return;
    clearTimer();
    emitEvent({ type: 'finishing', at: Date.now() });
  };
  const flush = () => {
    if (closed || !['running', 'finishing'].includes(content.phase)) return;
    finish();
    accepting = false;
    transient.provisional = '';
    emitEvent({ type: 'finished' });
  };
  const accept = (answers: JudgedAnswer[], cursor: number) => {
    const keys = new Set(
      [...content.notes.map(note => note.text), ...content.removed].map(answerKey)
    );
    const notes: BrainstormNote[] = [];
    for (const answer of answers) {
      const key = answerKey(answer.text);
      if (!key || keys.has(key)) continue;
      keys.add(key);
      notes.push({ ...answer, id: crypto.randomUUID() });
    }
    transient.feedback = notes.length
      ? `Added ${notes.length} ${notes.length === 1 ? 'answer' : 'answers'}.`
      : answers.length
        ? 'Already on the board.'
        : transient.practice
          ? 'No new sample answers found.'
          : 'No new qualifying answers.';
    emitEvent({ type: 'judged', notes, cursor });
  };
  const process = async () => {
    if (
      closed ||
      controller ||
      (!transient.practice && (transient.failure || !connection)) ||
      content.cursor >= content.segments.length
    )
      return;
    const currentGeneration = generation;
    const abort = new AbortController();
    const activeConnection = connection;
    controller = abort;
    transient.busy = true;
    publish();
    try {
      while (content.cursor < content.segments.length) {
        if (closed || generation !== currentGeneration || abort.signal.aborted) return;
        // Bound each request without discarding pending segments. New arrivals wait in order.
        let end = content.cursor;
        let text = '';
        while (
          end < content.segments.length &&
          (end === content.cursor || text.length + content.segments[end]!.text.length < 3000)
        ) {
          text += `${text ? '\n' : ''}${content.segments[end++]!.text}`;
        }
        const challenge = findChallenge(content.challengeId);
        let answers: JudgedAnswer[];
        if (transient.practice) answers = matchPracticeAnswers(challenge, text);
        else {
          const body = createBrainstormRequest({
            challenge,
            existing: content.notes.map(note => note.text),
            removed: content.removed,
            text,
            connection: activeConnection!,
          });
          const completion = await activeConnection!.requestCompletion({
            body,
            signal: abort.signal,
          });
          if (closed || generation !== currentGeneration || abort.signal.aborted) return;
          answers = parseBrainstormCompletion(completion, text);
        }
        if (closed || generation !== currentGeneration || abort.signal.aborted) return;
        // Read the current board here: the player may have removed a note during the request.
        accept(answers, end);
      }
    } catch (error) {
      if (closed || generation !== currentGeneration || abort.signal.aborted) return;
      transient.failure =
        error instanceof BrainstormRequestError
          ? error
          : new BrainstormRequestError('Judging is delayed. Try again.');
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
    state$,
    events$,
    setConnectionMode: (practice: boolean) => {
      if (closed) return;
      transient.practice = practice;
      publish();
    },
    configure: ({
      challengeId = content.challengeId,
      seconds = content.seconds,
    }: {
      challengeId?: string;
      seconds?: number | null;
    }) => {
      if (closed || ['running', 'finishing'].includes(content.phase)) return;
      if (
        !findChallenge(challengeId) ||
        (seconds !== null && (!Number.isFinite(seconds) || seconds <= 0))
      )
        return;
      cancelWork();
      transient.feedback = '';
      emitEvent({ type: 'configured', challengeId, seconds });
    },
    setPractice: (practice: boolean) => {
      if (closed || ['running', 'finishing'].includes(content.phase)) return;
      cancelWork();
      transient.practice = practice;
      transient.feedback = '';
      emitEvent({ type: 'configured', challengeId: content.challengeId, seconds: content.seconds });
    },
    connect: (next: BrainstormConnection) => {
      if (closed) return;
      connection = next;
      transient.connected = true;
      transient.failure = undefined;
      publish();
      void process();
    },
    begin: () => {
      if (
        closed ||
        ['running', 'finishing'].includes(content.phase) ||
        (!transient.practice && (!connection || transient.failure?.policy.terminal))
      )
        return;
      cancelWork();
      accepting = true;
      transient.feedback = '';
      emitEvent({
        type: 'started',
        roundId: crypto.randomUUID(),
        deadline: content.seconds === null ? null : Date.now() + content.seconds * 1000,
      });
      if (content.deadline !== null)
        timer = setInterval(() => {
          if (content.deadline !== null && Date.now() >= content.deadline) finish();
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
      emitEvent({ type: 'heard', id: key, text: segment.text });
      void process();
    }) satisfies MicrophoneOptions['onFinal'],
    updateProvisional: (text: string) => {
      if (closed || !accepting) return;
      transient.provisional = text;
      publish();
    },
    submitText: (text: string) => {
      if (closed || content.phase !== 'running' || !accepting || !text.trim()) return;
      if (content.deadline !== null && Date.now() >= content.deadline) {
        finish();
        return;
      }
      emitEvent({ type: 'heard', id: crypto.randomUUID(), text });
      void process();
    },
    remove: (id: string) => {
      if (!closed) emitEvent({ type: 'removed', id });
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

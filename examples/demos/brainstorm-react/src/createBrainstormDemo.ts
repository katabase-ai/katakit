import { EventLogPlugin, makeKatakit, type KatakitEvent, type WithEager } from '@katakit/core';
import type { MicrophoneOptions } from '@katakit/transcription/browser';
import { BehaviorSubject, type Observable } from 'rxjs';
import * as v from 'valibot';
import { answerKey, findChallenge } from './challenges';
import {
  BrainstormRequestError,
  createBrainstormRequest,
  judgeBrainstormCandidates,
  parseBrainstormCompletion,
  qualificationThreshold,
  requestBrainstormModel,
  type BrainstormConnection,
  type BrainstormJudgment,
} from './brainstormModel';

const TextSchema = v.pipe(v.string(), v.minLength(1), v.regex(/\S/));
const TimeSchema = v.pipe(v.number(), v.finite(), v.minValue(0));
const NoteSchema = v.object({ id: TextSchema, text: TextSchema, evidence: TextSchema });
const JudgmentSchema = v.object({
  text: v.string(),
  evidence: v.string(),
  probability: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)),
});
const EventSchema = v.variant('type', [
  v.object({
    type: v.literal('configured'),
    challengeId: v.pipe(
      TextSchema,
      v.check(id => !!findChallenge(id))
    ),
    seconds: v.nullable(v.pipe(TimeSchema, v.minValue(Number.MIN_VALUE))),
  }),
  v.object({ type: v.literal('started'), roundId: TextSchema, deadline: v.nullable(TimeSchema) }),
  v.object({ type: v.literal('heard'), id: TextSchema, text: TextSchema }),
  v.object({
    type: v.literal('judged'),
    notes: v.array(NoteSchema),
    judgments: v.array(JudgmentSchema),
    cursor: v.pipe(v.number(), v.integer(), v.minValue(1)),
  }),
  v.object({ type: v.literal('removed'), id: TextSchema }),
  v.object({ type: v.literal('finishing'), at: TimeSchema }),
  v.object({ type: v.literal('finished') }),
]);
export type BrainstormEvent = v.InferOutput<typeof EventSchema>;
export type BrainstormNote = v.InferOutput<typeof NoteSchema>;
type Content = {
  roundId: string;
  challengeId: string;
  seconds: number | null;
  deadline: number | null;
  endedAt: number | null;
  phase: 'idle' | 'running' | 'finishing' | 'finished';
  notes: BrainstormNote[];
  judgments: BrainstormJudgment[];
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
  judgments: [],
  removed: [],
  segments: [],
  cursor: 0,
});

/** Board content is derived only from accepted events; clocks and requests are transient. */
const reduce = (state: Content, event: BrainstormEvent): Content => {
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
      return {
        ...state,
        notes: [...state.notes, ...event.notes],
        judgments: [...state.judgments, ...event.judgments],
        cursor: event.cursor,
      };
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

/** Validate the entire imported history before constructing a runtime or starting any work. */
const restore = (input: unknown): KatakitEvent<BrainstormEvent>[] => {
  const events = v.parse(v.array(EventSchema), input);
  const history = events.map((event, seq): KatakitEvent<BrainstormEvent> => {
    const meta = (input as { meta?: unknown }[])[seq]!.meta;
    // Older demo histories had no core envelope. Upgrade deterministically.
    if (meta === undefined) return { ...event, meta: { seq, timestamp: new Date(0) } };
    if (
      !meta ||
      typeof meta !== 'object' ||
      !('seq' in meta) ||
      meta.seq !== seq ||
      !('timestamp' in meta)
    )
      throw new Error(`Invalid brainstorm event metadata at event ${seq}`);
    const timestamp =
      meta.timestamp instanceof Date
        ? new Date(meta.timestamp)
        : typeof meta.timestamp === 'string'
          ? new Date(meta.timestamp)
          : new Date(NaN);
    if (!Number.isFinite(timestamp.getTime()))
      throw new Error(`Invalid brainstorm event timestamp at event ${seq}`);
    return { ...event, meta: { seq, timestamp } };
  });
  let state = initial();
  const segments = new Set<string>();
  const ids = new Set<string>();
  for (const [index, event] of events.entries()) {
    let valid = true;
    switch (event.type) {
      case 'configured':
        // Also the explicit clear command; it may interrupt any phase.
        break;
      case 'started':
        valid =
          !['running', 'finishing'].includes(state.phase) &&
          !ids.has(event.roundId) &&
          (event.deadline === null) === (state.seconds === null);
        ids.add(event.roundId);
        break;
      case 'heard':
        valid = ['running', 'finishing'].includes(state.phase) && !segments.has(event.id);
        segments.add(event.id);
        break;
      case 'judged': {
        valid =
          state.phase !== 'idle' &&
          event.cursor > state.cursor &&
          event.cursor <= state.segments.length;
        const text = state.segments
          .slice(state.cursor, event.cursor)
          .map(segment => segment.text)
          .join('\n');
        const keys = new Set(
          [...state.notes.map(note => note.text), ...state.removed].map(answerKey)
        );
        valid &&= event.judgments.every(
          judgment =>
            !!judgment.text.trim() && !!judgment.evidence.trim() && text.includes(judgment.evidence)
        );
        for (const note of event.notes) {
          const key = answerKey(note.text);
          valid &&=
            !ids.has(note.id) &&
            !!key &&
            !keys.has(key) &&
            event.judgments.some(
              judgment =>
                judgment.text === note.text &&
                judgment.evidence === note.evidence &&
                judgment.probability >= qualificationThreshold
            );
          ids.add(note.id);
          keys.add(key);
        }
        break;
      }
      case 'removed':
        valid = state.notes.some(note => note.id === event.id);
        break;
      case 'finishing':
        valid = state.phase === 'running';
        break;
      case 'finished':
        valid = state.phase === 'finishing';
        break;
    }
    if (!valid) throw new Error(`Invalid brainstorm history at event ${index} (${event.type})`);
    state = reduce(state, event);
  }
  return history;
};

export type BrainstormSnapshot = Content & {
  interrupted: boolean;
  remaining: number | null;
  provisional: string;
  busy: boolean;
  connected: boolean;
  feedback: string;
  failure?: BrainstormRequestError;
};

/** One visit owns its event log, single-flight judging queue, and round clock. */
export const createBrainstormDemo = ({ initialEvents = [] }: { initialEvents?: unknown } = {}) => {
  const history = restore(initialEvents);
  const kit = makeKatakit({ plugins: [], existingEvents: history }).start();
  // Core accepts arbitrary events; this application owns validation at every write boundary.
  const emitEvent = (event: BrainstormEvent) =>
    kit.getMethods(EventLogPlugin).emitEvent(v.parse(EventSchema, event));
  const events$ = kit.getObservables(EventLogPlugin).events$ as WithEager<
    Observable<KatakitEvent<BrainstormEvent>>
  >;
  let content = initial();
  let connection: BrainstormConnection | undefined;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  let accepting = false;
  let generation = 0;
  const seen = new Set<string>();
  let transient = {
    interrupted: false,
    provisional: '',
    busy: false,
    connected: false,
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
    if (event.type === 'heard') seen.add(event.id);
    publish();
  });
  // Replay reconstructs content only. Recovery requires an explicit command, even on connect.
  transient.interrupted =
    ['running', 'finishing'].includes(content.phase) || content.cursor < content.segments.length;
  publish();
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
    if (closed || transient.interrupted || content.phase !== 'running') return;
    clearTimer();
    emitEvent({ type: 'finishing', at: Date.now() });
  };
  const flush = () => {
    if (closed || transient.interrupted || !['running', 'finishing'].includes(content.phase))
      return;
    finish();
    accepting = false;
    transient.provisional = '';
    emitEvent({ type: 'finished' });
  };
  const accept = (judgments: BrainstormJudgment[], cursor: number) => {
    const answers = judgments.filter(answer => answer.probability >= qualificationThreshold);
    const keys = new Set(
      [...content.notes.map(note => note.text), ...content.removed].map(answerKey)
    );
    const notes: BrainstormNote[] = [];
    for (const answer of answers) {
      const key = answerKey(answer.text);
      if (!key || keys.has(key)) continue;
      keys.add(key);
      notes.push({ text: answer.text, evidence: answer.evidence, id: crypto.randomUUID() });
    }
    transient.feedback = notes.length
      ? `Added ${notes.length} ${notes.length === 1 ? 'answer' : 'answers'}.`
      : answers.length
        ? 'Already on the board.'
        : 'No new qualifying answers.';
    emitEvent({ type: 'judged', notes, judgments, cursor });
  };
  const process = async () => {
    if (
      closed ||
      transient.interrupted ||
      controller ||
      transient.failure ||
      !connection ||
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
        const body = createBrainstormRequest({
          existing: content.notes.map(note => note.text),
          removed: content.removed,
          text,
          connection: activeConnection!,
        });
        const completion = await requestBrainstormModel(activeConnection.requestCompletion, {
          body,
          signal: abort.signal,
        });
        if (closed || generation !== currentGeneration || abort.signal.aborted) return;
        const candidates = parseBrainstormCompletion(completion, text);
        if (closed || generation !== currentGeneration || abort.signal.aborted) return;
        const judgments = await judgeBrainstormCandidates({
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
    /** Seal restored input, then judge only its pending suffix using an explicitly connected host. */
    recover: () => {
      if (closed || !transient.interrupted) return;
      transient.interrupted = false;
      flush();
      publish();
      void process();
    },
    /** Clear projected round content, retaining history and delivery deduplication for this visit. */
    clear: () => {
      if (closed) return;
      cancelWork();
      transient.interrupted = false;
      transient.feedback = '';
      emitEvent({ type: 'configured', challengeId: content.challengeId, seconds: content.seconds });
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
      transient.interrupted = false;
      transient.feedback = '';
      emitEvent({ type: 'configured', challengeId, seconds });
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
        transient.interrupted ||
        ['running', 'finishing'].includes(content.phase) ||
        (content.phase === 'finished' && transient.busy) ||
        !connection ||
        transient.failure?.policy.terminal
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
    remove: (id: string) => {
      if (!closed && content.notes.some(note => note.id === id)) emitEvent({ type: 'removed', id });
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
      if (!transient.interrupted) finish();
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

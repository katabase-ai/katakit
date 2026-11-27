import { EventLogPlugin, makeKatakit } from '@katakit/core';
import type { MicrophoneOptions } from '@katakit/transcription/browser';
import * as v from 'valibot';

export const colorClashColors = ['red', 'blue', 'green', 'yellow'] as const;
const ColorSchema = v.picklist(colorClashColors);
const TargetSchema = v.object({
  word: ColorSchema,
  ink: ColorSchema,
  sequence: v.number(),
  left: v.number(),
  top: v.number(),
});
type Color = v.InferOutput<typeof ColorSchema>;
type Target = v.InferOutput<typeof TargetSchema>;
const EventSchema = v.variant('type', [
  v.object({ type: v.literal('targetPrepared'), target: TargetSchema }),
  v.object({
    type: v.literal('roundStarted'),
    target: TargetSchema,
    instructionEnd: v.number(),
    roundEnd: v.number(),
  }),
  v.object({ type: v.literal('roundPlaying') }),
  v.object({ type: v.literal('roundFinished') }),
  v.object({ type: v.literal('answeredCorrectly'), target: TargetSchema }),
  v.object({ type: v.literal('answeredIncorrectly') }),
  v.object({ type: v.literal('transcriptFinalized'), text: v.string() }),
]);
type GameEvent = v.InferOutput<typeof EventSchema>;
type Content = {
  phase: 'ready' | 'instructions' | 'playing' | 'finished';
  score: number;
  target: Target;
  popped?: Target;
  mistake: number;
  transcript: string;
  instructionEnd: number;
  roundEnd: number;
};
export type ColorClashSnapshot = Omit<Content, 'instructionEnd' | 'roundEnd'> & {
  remainingMs: number;
  provisional: string;
};

const initial = (): Content => ({
  phase: 'ready',
  score: 0,
  target: { ink: 'red', word: 'blue', sequence: 0, left: 50, top: 50 },
  mistake: 0,
  transcript: '',
  instructionEnd: 0,
  roundEnd: 0,
});

/** Pure projection: event payloads contain every chosen target and deadline. */
const reduce = (state: Content, event: GameEvent): Content => {
  switch (event.type) {
    case 'targetPrepared':
      return { ...state, target: event.target };
    case 'roundStarted':
      return {
        ...initial(),
        phase: 'instructions',
        target: event.target,
        instructionEnd: event.instructionEnd,
        roundEnd: event.roundEnd,
      };
    case 'roundPlaying':
      return { ...state, phase: 'playing' };
    case 'roundFinished':
      return { ...state, phase: 'finished' };
    case 'answeredCorrectly':
      return {
        ...state,
        score: state.score + 1,
        mistake: 0,
        popped: state.target,
        target: event.target,
      };
    case 'answeredIncorrectly':
      return { ...state, mistake: state.mistake + 1 };
    case 'transcriptFinalized':
      return { ...state, transcript: `${state.transcript} ${event.text}`.trim().slice(-600) };
  }
};

/** Validate imported JSON before core replays it; core accepts existing events as supplied. */
const readEvent = (record: unknown, index: number) => {
  if (typeof record === 'object' && record !== null && !('meta' in record))
    return { ...v.parse(EventSchema, record), meta: { seq: index, timestamp: new Date(0) } };
  const { meta, ...payload } = v.parse(
    v.looseObject({
      meta: v.object({
        seq: v.pipe(v.number(), v.integer(), v.minValue(0)),
        timestamp: v.pipe(v.union([v.date(), v.pipe(v.string(), v.isoTimestamp())]), v.toDate()),
      }),
    }),
    record
  );
  return { ...v.parse(EventSchema, payload), meta };
};

/** One visit owns its log and transient recognition positions; the host owns capture and clock ticks. */
export const createColorClash = ({
  now = Date.now,
  random = Math.random,
  initialEvents = [],
}: { now?: () => number; random?: () => number; initialEvents?: unknown[] } = {}) => {
  const kit = makeKatakit({ existingEvents: initialEvents.map(readEvent), plugins: [] }).start();
  const log = kit.getMethods(EventLogPlugin);
  const { events$ } = kit.getObservables(EventLogPlugin);
  let content = initial();
  let provisional = '';
  let observedWords: string[] = [];
  let answeredPositions = new Set<number>();
  let closed = false;
  // A restored round has content, not a live microphone lease. Only begin arms live ticking.
  let liveRound = false;
  let beganLiveRound = false;
  let listeners: (() => void)[] = [];
  const snapshot = (): ColorClashSnapshot => ({
    phase: content.phase,
    score: content.score,
    target: content.target,
    popped: content.popped,
    mistake: content.mistake,
    transcript: content.transcript,
    provisional,
    remainingMs:
      content.phase === 'playing'
        ? Math.max(0, content.roundEnd - now())
        : content.phase === 'finished'
          ? 0
          : 20000,
  });
  let state = snapshot();
  const publish = () => {
    if (closed) return;
    state = snapshot();
    listeners.forEach(listener => listener());
  };
  const subscription = events$.subscribe(record => {
    content = reduce(content, v.parse(EventSchema, record));
    publish();
  });
  const emit = (event: GameEvent) => log.emitEvent(v.parse(EventSchema, event));
  const choose = <T>(choices: readonly T[]) => choices[Math.floor(random() * choices.length)]!;
  const makeTarget = (sequence: number, previous?: Color): Target => {
    const ink = choose(colorClashColors.filter(color => color !== previous));
    return {
      ink,
      word: choose(colorClashColors.filter(color => color !== ink)),
      sequence,
      left: 37 + random() * 26,
      top: 38 + random() * 24,
    };
  };
  if (initialEvents.length === 0) emit({ type: 'targetPrepared', target: makeTarget(0) });
  const advance = () => {
    if (closed || !liveRound) return;
    if (content.phase === 'instructions' && now() >= content.instructionEnd)
      emit({ type: 'roundPlaying' });
    if (content.phase !== 'playing') return;
    if (now() >= content.roundEnd) {
      liveRound = false;
      emit({ type: 'roundFinished' });
    } else publish();
  };
  const hear = (text: string) => {
    if (closed || !liveRound) return;
    advance();
    const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
    words.forEach((word, index) => {
      if (word === observedWords[index] || answeredPositions.has(index)) return;
      if (content.phase !== 'playing' || !colorClashColors.some(color => color === word)) return;
      answeredPositions.add(index);
      if (word === content.target.ink)
        emit({
          type: 'answeredCorrectly',
          target: makeTarget(content.target.sequence + 1, content.target.ink),
        });
      else emit({ type: 'answeredIncorrectly' });
    });
    observedWords = words;
  };
  const flush = () => {
    if (closed) return;
    if (provisional) emit({ type: 'transcriptFinalized', text: provisional });
    provisional = '';
    observedWords = [];
    answeredPositions = new Set();
    publish();
  };
  return {
    events$,
    isLiveRound: () => liveRound,
    hasBegunLiveRound: () => beganLiveRound,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter(current => current !== listener);
      };
    },
    begin: () => {
      if (closed) return;
      liveRound = true;
      beganLiveRound = true;
      observedWords = [];
      answeredPositions = new Set();
      provisional = '';
      const instructionEnd = now() + 1600;
      emit({
        type: 'roundStarted',
        target: makeTarget(content.target.sequence + 1),
        instructionEnd,
        roundEnd: instructionEnd + 20000,
      });
    },
    advance,
    finish: () => {
      if (
        !closed &&
        liveRound &&
        (content.phase === 'instructions' || content.phase === 'playing')
      ) {
        liveRound = false;
        emit({ type: 'roundFinished' });
      }
    },
    ingestSegment: (segment: Parameters<MicrophoneOptions['onFinal']>[0]) => {
      if (closed) return;
      hear(segment.text);
      provisional = segment.text;
      flush();
    },
    updateProvisional: (text: string) => {
      if (closed) return;
      hear(text);
      provisional = text;
      publish();
    },
    flush,
    close: () => {
      if (closed) return;
      closed = true;
      liveRound = false;
      subscription.unsubscribe();
      listeners = [];
    },
  };
};

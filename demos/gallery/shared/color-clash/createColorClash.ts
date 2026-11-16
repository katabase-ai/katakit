import type { MicrophoneOptions } from '@katakit/transcription/browser';

export const colorClashColors = ['red', 'blue', 'green', 'yellow', 'pink', 'orange'] as const;
type Color = (typeof colorClashColors)[number];
type Target = { word: Color; ink: Color; sequence: number; left: number; top: number };
type State = {
  phase: 'ready' | 'instructions' | 'playing' | 'finished';
  score: number;
  remainingMs: number;
  target: Target;
  transcript: string;
  provisional: string;
  popped?: Target;
  mistake: number;
};

/**
 * Only recognized color words drive the game. The clock is independent of recognition,
 * and provisional/final versions of a spoken word share one scoring position.
 */
export const createColorClash = ({
  now = () => performance.now(),
  random = Math.random,
}: { now?: () => number; random?: () => number } = {}) => {
  const choose = <T>(choices: readonly T[]) => choices[Math.floor(random() * choices.length)]!;
  const makeTarget = (sequence: number, previous?: Color) => {
    const ink = choose(colorClashColors.filter(color => color !== previous));
    return {
      ink,
      word: choose(colorClashColors.filter(color => color !== ink)),
      sequence,
      left: 37 + random() * 26,
      top: 38 + random() * 24,
    };
  };
  let state: State = {
    phase: 'ready',
    score: 0,
    remainingMs: 20000,
    target: makeTarget(0),
    transcript: '',
    provisional: '',
    mistake: 0,
  };
  let listeners: (() => void)[] = [];
  let instructionEnd = 0;
  let roundEnd = 0;
  let observedWords: string[] = [];
  let answeredPositions: number[] = [];
  let closed = false;
  const update = (patch: Partial<State>) => {
    if (closed) return;
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  };
  const advance = () => {
    if (state.phase === 'instructions' && now() >= instructionEnd) update({ phase: 'playing' });
    if (state.phase !== 'playing') return;
    const remainingMs = Math.max(0, roundEnd - now());
    update({ remainingMs, ...(remainingMs === 0 ? { phase: 'finished' } : {}) });
  };
  const hear = (text: string) => {
    if (closed) return;
    advance();
    const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
    words.forEach((word, index) => {
      if (word === observedWords[index] || answeredPositions.includes(index)) return;
      if (state.phase !== 'playing' || !colorClashColors.some(color => color === word)) return;
      answeredPositions.push(index);
      if (word === state.target.ink) {
        update({
          score: state.score + 1,
          popped: state.target,
          target: makeTarget(state.target.sequence + 1, state.target.ink),
        });
      } else update({ mistake: state.mistake + 1 });
    });
    observedWords = words;
  };
  const flush = () => {
    update({
      transcript: `${state.transcript} ${state.provisional}`.trim().slice(-600),
      provisional: '',
    });
    observedWords = [];
    answeredPositions = [];
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter(current => current !== listener);
      };
    },
    begin: () => {
      if (closed) return;
      observedWords = [];
      answeredPositions = [];
      instructionEnd = now() + 1600;
      roundEnd = instructionEnd + 20000;
      update({
        phase: 'instructions',
        score: 0,
        remainingMs: 20000,
        transcript: '',
        provisional: '',
        popped: undefined,
        mistake: 0,
        target: makeTarget(state.target.sequence + 1),
      });
    },
    advance,
    finish: () => {
      if (state.phase === 'instructions' || state.phase === 'playing')
        update({ phase: 'finished' });
    },
    ingestSegment: (segment: Parameters<MicrophoneOptions['onFinal']>[0]) => {
      hear(segment.text);
      update({ provisional: segment.text });
      flush();
    },
    updateProvisional: (text: string) => {
      hear(text);
      update({ provisional: text });
    },
    flush,
    close: () => {
      closed = true;
      listeners = [];
    },
  };
};

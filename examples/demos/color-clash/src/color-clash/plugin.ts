import { EventLogPlugin, makeKatakitPlugin, property } from '@katakit/core';
import { filter, scan, startWith } from 'rxjs';
import { colorClashColors, type Color, type Target } from './events';
import type {
  ColorClashEvent,
  RoundEndedEvent,
  RoundStartedEvent,
  TargetMatchedEvent,
  TargetMissedEvent,
} from './events';

const validTarget = (target: Target, sequence: number, previousInk?: Color) =>
  Number.isInteger(target?.sequence) &&
  target.sequence === sequence &&
  colorClashColors.includes(target.ink) &&
  colorClashColors.includes(target.word) &&
  target.ink !== target.word &&
  target.ink !== previousInk &&
  Number.isFinite(target.left) &&
  target.left >= 0 &&
  target.left <= 100 &&
  Number.isFinite(target.top) &&
  target.top >= 0 &&
  target.top <= 100;

export type GameContent = {
  phase: 'playing' | 'finished';
  deadline: number;
  target: Target;
  popped?: Target;
  score: number;
  mistake: number;
};

const project = (state: GameContent | null, event: ColorClashEvent): GameContent => {
  if (event.type === 'roundStarted')
    return {
      phase: 'playing',
      deadline: event.deadline,
      target: event.target,
      score: 0,
      mistake: 0,
    };
  if (!state) throw new Error('Missing opening Color Clash round.');
  switch (event.type) {
    case 'targetMatched':
      return {
        ...state,
        score: state.score + 1,
        mistake: 0,
        popped: state.target,
        target: event.nextTarget,
      };
    case 'targetMissed':
      return { ...state, mistake: state.mistake + 1 };
    case 'roundEnded':
      return { ...state, phase: 'finished' };
  }
};

/** Game content is projected solely from logged facts; no recognition or timers run on replay. */
export const ColorClashPlugin = makeKatakitPlugin({
  type: 'ColorClash',
  configure: (_options: {}) => ({}),
  observables: ({ getObservables }) => ({
    game$: property(
      getObservables(EventLogPlugin).events$.pipe(
        filter((event): event is ColorClashEvent =>
          ['roundStarted', 'targetMatched', 'targetMissed', 'roundEnded'].includes(event.type)
        ),
        scan(project, null as GameContent | null),
        startWith(null as GameContent | null)
      )
    ),
  }),
  methods: ({ getMethods, observables: { game$ } }) => {
    const { emitEvent } = getMethods(EventLogPlugin);
    return {
      startRound: (target: Target, deadline: number) => {
        const current = game$.get();
        if (current?.phase === 'playing') throw new Error('Round already playing.');
        if (
          !Number.isFinite(deadline) ||
          deadline <= 0 ||
          !validTarget(target, (current?.target.sequence ?? -1) + 1)
        )
          throw new Error('Invalid Color Clash round.');
        emitEvent({ type: 'roundStarted', target: { ...target }, deadline } satisfies Omit<
          RoundStartedEvent,
          'meta'
        >);
      },
      acceptAnswer: (spokenColor: Color, chooseNext: (target: Target) => Target) => {
        const game = game$.get();
        if (!game || game.phase !== 'playing') return;
        if (!colorClashColors.includes(spokenColor)) throw new Error('Invalid spoken color.');
        if (spokenColor === game.target.ink) {
          const nextTarget = chooseNext({ ...game.target });
          if (!validTarget(nextTarget, game.target.sequence + 1, game.target.ink))
            throw new Error('Invalid next Color Clash target.');
          emitEvent({
            type: 'targetMatched',
            targetSequence: game.target.sequence,
            spokenColor,
            nextTarget: { ...nextTarget },
          } satisfies Omit<TargetMatchedEvent, 'meta'>);
        } else
          emitEvent({
            type: 'targetMissed',
            targetSequence: game.target.sequence,
            spokenColor,
          } satisfies Omit<TargetMissedEvent, 'meta'>);
      },
      endRound: (reason: 'deadlineReached' | 'captureStopped') => {
        if (game$.get()?.phase === 'playing')
          emitEvent({ type: 'roundEnded', reason } satisfies Omit<RoundEndedEvent, 'meta'>);
      },
    };
  },
});

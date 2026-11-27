import { EventLogPlugin, makeKatakitPlugin, property } from '@katakit/core';
import { filter, scan, startWith } from 'rxjs';
import type {
  Color,
  ColorClashEvent,
  RoundEndedEvent,
  RoundStartedEvent,
  Target,
  TargetMatchedEvent,
  TargetMissedEvent,
} from './events';

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
        if (game$.get()?.phase === 'playing') throw new Error('Round already playing.');
        emitEvent({ type: 'roundStarted', target, deadline } satisfies Omit<
          RoundStartedEvent,
          'meta'
        >);
      },
      acceptAnswer: (spokenColor: Color, chooseNext: (target: Target) => Target) => {
        const game = game$.get();
        if (!game || game.phase !== 'playing') return;
        if (spokenColor === game.target.ink) {
          const nextTarget = chooseNext(game.target);
          emitEvent({
            type: 'targetMatched',
            targetSequence: game.target.sequence,
            spokenColor,
            nextTarget,
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

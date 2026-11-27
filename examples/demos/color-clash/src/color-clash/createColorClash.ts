import { EventLogPlugin, makeKatakit } from '@katakit/core';
import type { MicrophoneOptions } from '@katakit/transcription/browser';
import { ColorClashPlugin } from './plugin';
import { colorClashColors, type Color, type Target } from './events';

export { colorClashColors } from './events';

// Capture eligibility is transient; the event log alone owns the game phase.
type LivePhase = 'idle' | 'instructions' | 'playing' | 'ended' | 'cancelled';

/** One visit owns game history and transient instruction, recognition and display state. */
export const createColorClash = ({
  now = Date.now,
  random = Math.random,
  initialEvents = [],
}: {
  now?: () => number;
  random?: () => number;
  initialEvents?: Parameters<typeof makeKatakit>[0]['existingEvents'];
} = {}) => {
  const kit = makeKatakit({
    existingEvents: initialEvents,
    plugins: [ColorClashPlugin.configure({})],
  }).start();
  const { game$ } = kit.getObservables(ColorClashPlugin);
  const game = kit.getMethods(ColorClashPlugin);
  const { events$ } = kit.getObservables(EventLogPlugin);
  let instructionsUntil = 0;
  let livePhase: LivePhase = 'idle';
  let transcript = '';
  let provisional = '';
  let observedWords: string[] = [];
  let answeredPositions = new Set<number>();
  let closed = false;
  let listeners: (() => void)[] = [];
  const isLiveRound = () => livePhase === 'instructions' || livePhase === 'playing';
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
  const snapshot = () => {
    const content = game$.get();
    const showingInstructions = livePhase === 'instructions';
    return {
      phase: showingInstructions
        ? ('instructions' as const)
        : (content?.phase ?? (livePhase === 'cancelled' ? 'finished' : 'ready')),
      score: showingInstructions ? 0 : (content?.score ?? 0),
      remainingMs:
        showingInstructions || !content
          ? 20000
          : content.phase === 'playing'
            ? Math.max(0, content.deadline - now())
            : 0,
      target: showingInstructions ? null : (content?.target ?? null),
      popped: showingInstructions ? undefined : content?.popped,
      mistake: showingInstructions ? 0 : (content?.mistake ?? 0),
      transcript,
      provisional,
    };
  };
  let state = snapshot();
  const publish = () => {
    if (closed) return;
    state = snapshot();
    listeners.forEach(listener => listener());
  };
  const subscription = game$.subscribe(publish);
  const advance = () => {
    if (closed || !isLiveRound()) return;
    if (livePhase === 'instructions') {
      if (now() < instructionsUntil) return;
      livePhase = 'playing';
      const target = makeTarget((game$.get()?.target.sequence ?? -1) + 1);
      game.startRound(target, now() + 20000);
    }
    const content = game$.get();
    if (content?.phase !== 'playing') return;
    if (now() >= content.deadline) {
      livePhase = 'ended';
      game.endRound('deadlineReached');
    } else publish();
  };
  const hear = (text: string) => {
    if (closed || !isLiveRound()) return;
    advance();
    const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
    words.forEach((word, index) => {
      if (word === observedWords[index] || answeredPositions.has(index)) return;
      if (game$.get()?.phase !== 'playing' || !colorClashColors.some(color => color === word))
        return;
      answeredPositions.add(index);
      game.acceptAnswer(word as Color, previous => makeTarget(previous.sequence + 1, previous.ink));
    });
    observedWords = words;
  };
  const flush = () => {
    if (closed) return;
    transcript = `${transcript} ${provisional}`.trim().slice(-600);
    provisional = '';
    observedWords = [];
    answeredPositions = new Set();
    publish();
  };
  return {
    events$,
    game$,
    isLiveRound,
    hasBegunLiveRound: () => livePhase === 'playing' || livePhase === 'ended',
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter(current => current !== listener);
      };
    },
    begin: () => {
      if (closed || isLiveRound() || game$.get()?.phase === 'playing') return;
      livePhase = 'instructions';
      instructionsUntil = now() + 1600;
      observedWords = [];
      answeredPositions = new Set();
      transcript = '';
      provisional = '';
      publish();
    },
    advance,
    finish: () => {
      if (closed || !isLiveRound()) return;
      if (livePhase === 'instructions') {
        livePhase = 'cancelled';
        publish();
      } else {
        livePhase = 'ended';
        game.endRound('captureStopped');
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
      livePhase = 'idle';
      subscription.unsubscribe();
      listeners = [];
    },
  };
};

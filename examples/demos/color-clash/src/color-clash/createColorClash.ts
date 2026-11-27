import { EventLogPlugin, makeKatakit } from '@katakit/core';
import type { MicrophoneOptions } from '@katakit/transcription/browser';
import { ColorClashPlugin } from './plugin';
import { colorClashColors, type Color, type Target } from './events';

export { colorClashColors } from './events';

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
  let showingInstructions = false;
  let cancelledBeforeRound = false;
  let liveRound = false;
  let beganLiveRound = false;
  let transcript = '';
  let provisional = '';
  let observedWords: string[] = [];
  let answeredPositions = new Set<number>();
  let closed = false;
  let listeners: (() => void)[] = [];
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
    return {
      phase: showingInstructions
        ? ('instructions' as const)
        : (content?.phase ?? (cancelledBeforeRound ? 'finished' : 'ready')),
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
    if (closed || !liveRound) return;
    if (showingInstructions) {
      if (now() < instructionsUntil) return;
      showingInstructions = false;
      const target = makeTarget((game$.get()?.target.sequence ?? -1) + 1);
      beganLiveRound = true;
      game.startRound(target, now() + 20000);
    }
    const content = game$.get();
    if (content?.phase !== 'playing') return;
    if (now() >= content.deadline) {
      liveRound = false;
      game.endRound('deadlineReached');
    } else publish();
  };
  const hear = (text: string) => {
    if (closed || !liveRound) return;
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
      if (closed || game$.get()?.phase === 'playing') return;
      liveRound = true;
      showingInstructions = true;
      beganLiveRound = false;
      cancelledBeforeRound = false;
      instructionsUntil = now() + 1600;
      observedWords = [];
      answeredPositions = new Set();
      transcript = '';
      provisional = '';
      publish();
    },
    advance,
    finish: () => {
      if (closed || !liveRound) return;
      liveRound = false;
      if (showingInstructions) {
        showingInstructions = false;
        cancelledBeforeRound = true;
        publish();
      } else game.endRound('captureStopped');
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

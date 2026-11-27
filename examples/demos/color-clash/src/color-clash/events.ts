import type { KatakitEvent } from '@katakit/core';

export const colorClashColors = ['red', 'blue', 'green', 'yellow'] as const;
export type Color = (typeof colorClashColors)[number];
export type Target = { word: Color; ink: Color; sequence: number; left: number; top: number };

/** The first target and deadline are chosen once, when the instruction screen completes. */
export type RoundStartedEvent = KatakitEvent<{
  type: 'roundStarted';
  target: Target;
  deadline: number;
}>;
/** A correct answer also records the next randomly chosen target. */
export type TargetMatchedEvent = KatakitEvent<{
  type: 'targetMatched';
  targetSequence: number;
  spokenColor: Color;
  nextTarget: Target;
}>;
export type TargetMissedEvent = KatakitEvent<{
  type: 'targetMissed';
  targetSequence: number;
  spokenColor: Color;
}>;
export type RoundEndedEvent = KatakitEvent<{
  type: 'roundEnded';
  reason: 'deadlineReached' | 'captureStopped';
}>;
export type ColorClashEvent =
  | RoundStartedEvent
  | TargetMatchedEvent
  | TargetMissedEvent
  | RoundEndedEvent;

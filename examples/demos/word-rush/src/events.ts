import type { KatakitEvent } from '@katakit/core';
import * as v from 'valibot';
import type { WordRushJudgment } from './wordRushModel';

export type WordRushNote = { id: string; text: string; evidence: string };

export type ConfiguredEvent = KatakitEvent<{
  type: 'configured';
  challengeId: string;
  seconds: number | null;
}>;
export type StartedEvent = KatakitEvent<{
  type: 'started';
  roundId: string;
  deadline: number | null;
}>;
export type HeardEvent = KatakitEvent<{ type: 'heard'; id: string; text: string }>;
export type JudgedEvent = KatakitEvent<{
  type: 'judged';
  notes: WordRushNote[];
  judgments: WordRushJudgment[];
  cursor: number;
}>;
export type RemovedEvent = KatakitEvent<{ type: 'removed'; id: string }>;
export type FinishingEvent = KatakitEvent<{ type: 'finishing'; at: number }>;
export type FinishedEvent = KatakitEvent<{ type: 'finished' }>;
export type WordRushEvent =
  | ConfiguredEvent
  | StartedEvent
  | HeardEvent
  | JudgedEvent
  | RemovedEvent
  | FinishingEvent
  | FinishedEvent;

const NoteSchema = v.object({ id: v.string(), text: v.string(), evidence: v.string() });
const JudgmentSchema = v.object({
  text: v.string(),
  evidence: v.string(),
  probability: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)),
});
/** Validate new facts before appending them; typed in-memory history is replayed as supplied. */
export const WordRushEventSchema = v.variant('type', [
  v.object({
    type: v.literal('configured'),
    challengeId: v.string(),
    seconds: v.nullable(v.number()),
  }),
  v.object({ type: v.literal('started'), roundId: v.string(), deadline: v.nullable(v.number()) }),
  v.object({ type: v.literal('heard'), id: v.string(), text: v.string() }),
  v.object({
    type: v.literal('judged'),
    notes: v.array(NoteSchema),
    judgments: v.array(JudgmentSchema),
    cursor: v.number(),
  }),
  v.object({ type: v.literal('removed'), id: v.string() }),
  v.object({ type: v.literal('finishing'), at: v.number() }),
  v.object({ type: v.literal('finished') }),
]);

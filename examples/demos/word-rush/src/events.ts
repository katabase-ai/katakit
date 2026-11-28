import type { KatakitEvent } from '@katakit/core';
import * as v from 'valibot';
import type { WordRushJudgment } from './wordRushModel';

export type WordRushNote = { id: string; text: string; evidence: string };

export type RoundStartedEvent = KatakitEvent<{
  type: 'roundStarted';
  roundId: string;
  challengeId: string;
  seconds: number | null;
  deadline: number | null;
}>;
export type SpeechSegmentRecordedEvent = KatakitEvent<{
  type: 'speechSegmentRecorded';
  id: string;
  text: string;
}>;
export type JudgmentsAcceptedEvent = KatakitEvent<{
  type: 'judgmentsAccepted';
  notes: WordRushNote[];
  judgments: WordRushJudgment[];
  cursor: number;
}>;
export type AnswerRemovedEvent = KatakitEvent<{ type: 'answerRemoved'; id: string }>;
export type RoundEndingStartedEvent = KatakitEvent<{ type: 'roundEndingStarted'; at: number }>;
export type RoundInputSealedEvent = KatakitEvent<{ type: 'roundInputSealed' }>;
export type WordRushEvent =
  | RoundStartedEvent
  | SpeechSegmentRecordedEvent
  | JudgmentsAcceptedEvent
  | AnswerRemovedEvent
  | RoundEndingStartedEvent
  | RoundInputSealedEvent;

const NoteSchema = v.object({ id: v.string(), text: v.string(), evidence: v.string() });
const JudgmentSchema = v.object({
  text: v.string(),
  evidence: v.string(),
  probability: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)),
});
/** Validate new facts before appending them; typed in-memory history is replayed as supplied. */
export const WordRushEventSchema = v.variant('type', [
  v.object({
    type: v.literal('roundStarted'),
    roundId: v.string(),
    challengeId: v.string(),
    seconds: v.nullable(v.number()),
    deadline: v.nullable(v.number()),
  }),
  v.object({ type: v.literal('speechSegmentRecorded'), id: v.string(), text: v.string() }),
  v.object({
    type: v.literal('judgmentsAccepted'),
    notes: v.array(NoteSchema),
    judgments: v.array(JudgmentSchema),
    cursor: v.number(),
  }),
  v.object({ type: v.literal('answerRemoved'), id: v.string() }),
  v.object({ type: v.literal('roundEndingStarted'), at: v.number() }),
  v.object({ type: v.literal('roundInputSealed') }),
]);

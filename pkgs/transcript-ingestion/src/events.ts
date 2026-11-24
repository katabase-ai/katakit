import type { KatakitEvent } from '@katakit/core';

export type Utterance = {
  id: string;
  text: string;
  speaker: string;
  startMs: number;
  endMs: number;
};

export type UtteranceAddedEvent = KatakitEvent<
  {
    type: 'utteranceAdded';
  } & Utterance
>;

export type PendingConversationTurn = {
  text: string;
  startMs: number;
  endMs: number;
};

export type ConversationTurn = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
};

export type ConversationTurnAddedEvent = KatakitEvent<
  {
    type: 'conversationTurnAdded';
  } & ConversationTurn
>;

export type ProvisionalUtterance = {
  text: string;
  speaker: string;
};

export type ProvisionalUtteranceAddedEvent = KatakitEvent<
  {
    type: 'provisionalUtteranceAdded';
  } & ProvisionalUtterance
>;

export type TranscriptIngestionEvent =
  | UtteranceAddedEvent
  | ConversationTurnAddedEvent
  | ProvisionalUtteranceAddedEvent;

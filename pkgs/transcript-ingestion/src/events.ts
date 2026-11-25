import type { KatakitEvent } from '@katakit/core';
import type { TranscriptSegment, TranscriptTurn } from './plugin';

/** Generic finalized utterance. Legacy callers may omit sourceId (the `default` source). */
export type Utterance = Omit<TranscriptSegment, 'sourceId'> & { sourceId?: string };
/** Built-in log payload for a finalized utterance; preserves producer identity. */
export type UtteranceAddedEvent = KatakitEvent<{ type: 'utteranceAdded' } & Utterance>;
/** Pending turn includes stable identity and source/speaker/timestamp metadata. */
export type PendingConversationTurn = TranscriptTurn;
/** Completed turn; legacy core histories may omit sourceId. */
export type ConversationTurn = Omit<TranscriptTurn, 'sourceId'> & { sourceId?: string };
/** Built-in log record for a completed turn boundary. */
export type ConversationTurnAddedEvent = KatakitEvent<
  { type: 'conversationTurnAdded' } & ConversationTurn
>;
/** Transient text and speaker input, owned by the ingestion instance until cleared or closed. */
export type ProvisionalUtterance = { text: string; speaker?: string };
/** Legacy history shape, ignored on replay; new provisional updates are not persisted. */
export type ProvisionalUtteranceAddedEvent = KatakitEvent<
  { type: 'provisionalUtteranceAdded' } & ProvisionalUtterance
>;
/** Discard current content and reopen the source/segment identity scope. */
export type TranscriptResetEvent = KatakitEvent<{ type: 'transcriptReset' }>;
/** Core log records understood by ingestion; legacy provisional history is ignored. */
export type TranscriptIngestionEvent =
  | UtteranceAddedEvent
  | ConversationTurnAddedEvent
  | TranscriptResetEvent
  | ProvisionalUtteranceAddedEvent;

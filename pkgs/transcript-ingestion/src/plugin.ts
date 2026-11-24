import { EventLogPlugin, evolve, makeKatakitPlugin, property } from '@katakit/core';
import { distinctUntilChanged, filter, map, scan, startWith } from 'rxjs';
import {
  ConversationTurn,
  ConversationTurnAddedEvent,
  PendingConversationTurn,
  ProvisionalUtterance,
  ProvisionalUtteranceAddedEvent,
  Utterance,
  UtteranceAddedEvent,
} from './events';

export const makeTranscriptIngestionPlugin = ({
  turnSilenceMs = 1400,
}: {
  turnSilenceMs?: number;
} = {}) => {
  if (!Number.isFinite(turnSilenceMs) || turnSilenceMs < 0) {
    throw new Error('turnSilenceMs must be a nonnegative number');
  }

  return makeKatakitPlugin({
    type: 'TranscriptIngestion',
    configure: (_options: {}) => ({}),
    observables: ({ getObservables }) => {
      const { events$ } = getObservables(EventLogPlugin);

      const utterances$ = events$.pipe(
        filter((event): event is UtteranceAddedEvent => event.type === 'utteranceAdded'),
        map(({ meta: _meta, type: _type, ...utterance }) => utterance)
      );
      const collectedUtterances$ = property(
        utterances$.pipe(
          scan((utterances, utterance) => [...utterances, utterance], [] as Utterance[]),
          startWith([] as Utterance[])
        )
      );

      const conversationTurns$ = events$.pipe(
        filter(
          (event): event is ConversationTurnAddedEvent => event.type === 'conversationTurnAdded'
        ),
        map(({ meta: _meta, type: _type, ...conversationTurn }) => conversationTurn)
      );
      const collectedConversationTurns$ = property(
        conversationTurns$.pipe(
          scan((turns, turn) => [...turns, turn], [] as ConversationTurn[]),
          startWith([] as ConversationTurn[])
        )
      );

      const provisionalUtterances$ = events$.pipe(
        filter(
          (event): event is ProvisionalUtteranceAddedEvent =>
            event.type === 'provisionalUtteranceAdded'
        ),
        map(
          ({ meta: _meta, type: _type, ...provisionalUtterance }) =>
            provisionalUtterance satisfies ProvisionalUtterance
        )
      );

      const provisionalUtterance$ = property(
        events$.pipe(
          filter(
            (
              event
            ): event is
              | ProvisionalUtteranceAddedEvent
              | UtteranceAddedEvent
              | ConversationTurnAddedEvent =>
              event.type === 'provisionalUtteranceAdded' ||
              event.type === 'utteranceAdded' ||
              event.type === 'conversationTurnAdded'
          ),
          map(event => {
            if (event.type === 'provisionalUtteranceAdded') {
              const { meta: _meta, type: _type, ...provisional } = event;
              return provisional;
            }
            return null;
          }),
          startWith(null),
          distinctUntilChanged()
        )
      );

      const pendingConversationTurn$ = property(
        events$.pipe(
          filter(
            (event): event is UtteranceAddedEvent | ConversationTurnAddedEvent =>
              event.type === 'utteranceAdded' || event.type === 'conversationTurnAdded'
          ),
          evolve((acc, event) => {
            if (event.type === 'conversationTurnAdded') {
              return [];
            }
            const { type: _type, meta: _meta, ...utterance } = event;
            return [...acc, utterance];
          }, [] as Utterance[]),
          evolve(
            (acc, utterances) => {
              if (utterances.length === 0) {
                return null;
              }
              const last = utterances[utterances.length - 1]!;
              if (acc) {
                return {
                  ...acc,
                  endMs: last.endMs,
                  text: acc.text + ' ' + last.text,
                } satisfies PendingConversationTurn;
              } else if (utterances.length === 1) {
                return {
                  text: last.text,
                  startMs: last.startMs,
                  endMs: last.endMs,
                } satisfies PendingConversationTurn;
              } else {
                throw new Error(
                  'Unexpected state: multiple utterances without existing accumulators'
                );
              }
            },
            null as null | PendingConversationTurn
          ),
          startWith(null)
        )
      );

      return {
        utterances$,
        collectedUtterances$,
        conversationTurns$,
        collectedConversationTurns$,
        provisionalUtterances$,
        provisionalUtterance$,
        pendingConversationTurn$,
      };
    },
    methods: ({ observables: { pendingConversationTurn$ }, getMethods }) => {
      const { emitEvent } = getMethods(EventLogPlugin);

      let timer: ReturnType<typeof setTimeout> | null = null;

      const rearmConversationTurnDetector = () => {
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          const pendingTurn = pendingConversationTurn$.get();
          if (pendingTurn) {
            emitEvent({
              type: 'conversationTurnAdded',
              id: crypto.randomUUID(),
              ...pendingTurn,
            } satisfies Omit<ConversationTurnAddedEvent, 'meta'>);
          }
        }, turnSilenceMs);
      };

      return {
        updateProvisionalUtterance: (provisionalUtterance: ProvisionalUtterance) => {
          emitEvent({
            type: 'provisionalUtteranceAdded',
            ...provisionalUtterance,
          } satisfies Omit<ProvisionalUtteranceAddedEvent, 'meta'>);
        },
        ingestUtterance: (utterance: Utterance) => {
          emitEvent({
            type: 'utteranceAdded',
            ...utterance,
          });

          rearmConversationTurnDetector();
        },
        /** Stop the plugin's timer; the host must stop its audio source separately. */
        close: () => {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
        },
      };
    },
  });
};

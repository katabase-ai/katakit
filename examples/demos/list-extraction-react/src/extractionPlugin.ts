import { makeKatakitPlugin, property } from '@katakit/core';
import type { makeEventLogPlugin } from '@katakit/event-log';
import type { TranscriptTurn } from '@katakit/transcript-ingestion';
import { scan, shareReplay, startWith, Subject, takeUntil } from 'rxjs';
import * as v from 'valibot';
import {
  defaultRules,
  ItemSchema,
  RulesSchema,
  type ExtractedItem,
  type ListRule,
} from './extractionModel';

const TranscriptEntrySchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  sourceId: v.pipe(v.string(), v.minLength(1)),
  text: v.pipe(v.string(), v.minLength(1)),
  speaker: v.optional(v.string()),
  startMs: v.optional(v.pipe(v.number(), v.finite())),
  endMs: v.optional(v.pipe(v.number(), v.finite())),
}) satisfies v.GenericSchema<TranscriptTurn>;

export const ExtractionEventSchema = v.variant('type', [
  v.strictObject({ type: v.literal('transcriptSegment'), segment: TranscriptEntrySchema }),
  v.strictObject({
    type: v.literal('transcriptTurn'),
    turn: TranscriptEntrySchema,
  }),
  v.strictObject({ type: v.literal('rulesChanged'), rules: RulesSchema }),
  v.strictObject({
    type: v.literal('extracted'),
    rules: RulesSchema,
    items: v.array(ItemSchema),
    turnIds: v.array(v.string()),
    sample: v.boolean(),
  }),
  v.strictObject({
    type: v.literal('itemEdited'),
    id: v.string(),
    text: v.pipe(v.string(), v.minLength(1), v.maxLength(2000), v.regex(/\S/)),
  }),
  v.strictObject({ type: v.literal('visibilityChanged'), id: v.string(), hidden: v.boolean() }),
  v.strictObject({ type: v.literal('sessionCleared') }),
]);
export type ExtractionEvent = v.InferOutput<typeof ExtractionEventSchema>;
export type ExtractionContent = {
  rules: ListRule[];
  turns: TranscriptTurn[];
  result?: { rules: ListRule[]; items: ExtractedItem[]; turnIds: string[]; sample: boolean };
};

/** All durable content is projected from events. No replay runs inference or allocates IDs. */
export const makeExtractionPlugin = (
  EventLog: ReturnType<typeof makeEventLogPlugin<ExtractionEvent>>
) =>
  makeKatakitPlugin({
    type: 'ListExtraction',
    configure: (_options: {}) => ({ closed: new Subject<void>() }),
    observables: ({ options, getObservables }) => {
      const initial: ExtractionContent = { rules: v.parse(RulesSchema, defaultRules), turns: [] };
      const content$ = property(
        getObservables(EventLog).events$.pipe(
          scan((content: ExtractionContent, event): ExtractionContent => {
            switch (event.type) {
              case 'transcriptSegment':
                return content;
              case 'transcriptTurn':
                return content.turns.some(turn => turn.id === event.turn.id)
                  ? content
                  : { ...content, turns: [...content.turns, event.turn] };
              case 'rulesChanged':
                return { ...content, rules: event.rules };
              case 'extracted':
                return {
                  ...content,
                  result: {
                    rules: event.rules,
                    items: event.items,
                    turnIds: event.turnIds,
                    sample: event.sample,
                  },
                };
              case 'itemEdited':
              case 'visibilityChanged':
                return {
                  ...content,
                  result: content.result && {
                    ...content.result,
                    items: content.result.items.map(item =>
                      item.id !== event.id
                        ? item
                        : event.type === 'itemEdited'
                          ? { ...item, text: event.text }
                          : { ...item, hidden: event.hidden }
                    ),
                  },
                };
              case 'sessionCleared':
                return { rules: content.rules, turns: [] };
            }
          }, initial),
          startWith(initial),
          takeUntil(options.closed),
          shareReplay({ bufferSize: 1, refCount: true })
        )
      );
      return { content$ };
    },
    methods: ({ options, getMethods }) => ({
      record: (event: ExtractionEvent) => getMethods(EventLog).emitEvent(event),
      close: () => {
        options.closed.next();
        options.closed.complete();
      },
    }),
  });

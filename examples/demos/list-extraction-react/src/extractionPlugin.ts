import { EventLogPlugin, makeKatakitPlugin, property } from '@katakit/core';
import { map, scan, shareReplay, startWith, Subject, takeUntil } from 'rxjs';
import * as v from 'valibot';
import {
  defaultRules,
  ItemSchema,
  RulesSchema,
  type ExtractedItem,
  type ListRule,
} from './extractionModel';

export const ExtractionEventSchema = v.variant('type', [
  v.strictObject({
    type: v.literal('transcriptTurn'),
    turn: v.object({
      id: v.string(),
      sourceId: v.string(),
      text: v.string(),
      speaker: v.optional(v.string()),
      startMs: v.optional(v.number()),
      endMs: v.optional(v.number()),
    }),
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
export type TranscriptTurn = Extract<ExtractionEvent, { type: 'transcriptTurn' }>['turn'];
export const readExtractionEvent = (record: unknown, index: number) => {
  // Payload-only histories predate core metadata. Preserve order; epoch denotes unknown time.
  if (typeof record === 'object' && record !== null && !('meta' in record))
    return {
      ...v.parse(ExtractionEventSchema, record),
      meta: { seq: index, timestamp: new Date(0) },
    };
  const { meta, ...payload } = v.parse(
    v.looseObject({
      meta: v.object({
        seq: v.pipe(v.number(), v.integer(), v.minValue(0)),
        timestamp: v.pipe(v.union([v.date(), v.pipe(v.string(), v.isoTimestamp())]), v.toDate()),
      }),
    }),
    record
  );
  return { ...v.parse(ExtractionEventSchema, payload), meta };
};
export type ExtractionContent = {
  rules: ListRule[];
  turns: TranscriptTurn[];
  result?: { rules: ListRule[]; items: ExtractedItem[]; turnIds: string[]; sample: boolean };
};

/** All durable content is projected from events. No replay runs inference or allocates IDs. */
export const makeExtractionPlugin = () =>
  makeKatakitPlugin({
    type: 'ListExtraction',
    configure: (_options: {}) => ({ closed: new Subject<void>() }),
    observables: ({ options, getObservables }) => {
      const initial: ExtractionContent = { rules: v.parse(RulesSchema, defaultRules), turns: [] };
      const content$ = property(
        getObservables(EventLogPlugin).events$.pipe(
          map(readExtractionEvent),
          scan((content: ExtractionContent, event): ExtractionContent => {
            switch (event.type) {
              case 'transcriptTurn':
                return { ...content, turns: [...content.turns, event.turn] };
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
      record: (event: ExtractionEvent) =>
        getMethods(EventLogPlugin).emitEvent(v.parse(ExtractionEventSchema, event)),
      close: () => {
        options.closed.next();
        options.closed.complete();
      },
    }),
  });

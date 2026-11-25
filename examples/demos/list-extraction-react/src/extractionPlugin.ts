import { EventLogPlugin, makeKatakitPlugin, property, type KatakitEvent } from '@katakit/core';
import type { TranscriptTurn } from '@katakit/transcript-ingestion';
import { map, scan, shareReplay, startWith, Subject, takeUntil } from 'rxjs';
import * as v from 'valibot';
import {
  defaultRules,
  ItemSchema,
  RulesSchema,
  type ExtractedItem,
  type ListRule,
} from './extractionModel';

export type { TranscriptTurn } from '@katakit/transcript-ingestion';

const TranscriptEntrySchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  sourceId: v.pipe(v.string(), v.minLength(1)),
  text: v.pipe(v.string(), v.minLength(1), v.regex(/\S/)),
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
const MetadataSchema = v.strictObject({
  seq: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER)),
  timestamp: v.union([
    v.date(),
    v.pipe(
      v.string(),
      v.isoTimestamp(),
      v.transform(value => new Date(value))
    ),
  ]),
});

/** Validate JSON/native history; legacy snapshots get deterministic envelope metadata only. */
export const parseExtractionHistory = (value: unknown): KatakitEvent<ExtractionEvent>[] =>
  v
    .parse(v.array(v.looseObject({ meta: v.optional(MetadataSchema) })), value)
    .map(({ meta, ...event }, seq) => ({
      ...v.parse(ExtractionEventSchema, event),
      meta: meta ?? { seq, timestamp: new Date(0) },
    }));
export type ExtractionContent = {
  rules: ListRule[];
  result?: { rules: ListRule[]; items: ExtractedItem[]; turnIds: string[]; sample: boolean };
};

/** All durable content is projected from events. No replay runs inference or allocates IDs. */
export const makeExtractionPlugin = () =>
  makeKatakitPlugin({
    type: 'ListExtraction',
    configure: (_options: {}) => ({ closed: new Subject<void>() }),
    observables: ({ options, getObservables }) => {
      const initial: ExtractionContent = { rules: v.parse(RulesSchema, defaultRules) };
      const content$ = property(
        getObservables(EventLogPlugin).events$.pipe(
          map(({ meta: _meta, ...event }) => v.parse(ExtractionEventSchema, event)),
          scan((content: ExtractionContent, event): ExtractionContent => {
            switch (event.type) {
              case 'transcriptSegment':
              case 'transcriptTurn':
                return content;
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
                return { rules: content.rules };
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

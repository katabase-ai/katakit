import type { TranscriptTurn } from '@katakit/transcript-ingestion';
import { applyNotesResult } from '../src/applyNotesResult';
import {
  createNotesRequest,
  NotesRequestError,
  parseNotesCompletion,
  type Note,
} from '../src/notesModel';
import { createInferenceHandler } from './inferenceHandler';
import { environmentProviders, readCompletionUsage } from './providers';

const transcript = [
  'Okay so for the offsite we need to book the venue by Friday.',
  'Priya said she can handle catering if we give her the headcount.',
  'Headcount is probably twenty two, maybe twenty five with the contractors.',
  'And we still need someone to own the agenda, let’s say Marcus.',
].map((text, index) => ({ id: `turn-${index}`, sourceId: 'check', text }));

/** A second request adds detail to the outline the first produced, which exercises `underId`. */
const followUp = {
  id: 'turn-4',
  sourceId: 'check',
  text: 'For the venue, we also need a projector.',
};

export type DefaultModelResult = {
  provider: string;
  model: string;
  result: 'passed' | 'failed' | 'skipped';
  detail: string;
  latencyMs?: number;
  tokens?: number;
};

const describeFailure = (error: unknown) =>
  error instanceof NotesRequestError
    ? (error.policy.code ?? error.message)
    : error instanceof Error
      ? error.message
      : String(error);

/**
 * Send the real Structured Notes requests to each provider's default model with the key in
 * `environment`: one that starts an outline and one that adds detail to it. A default passes when
 * both finish and return notes the demo can apply. Providers without a key are skipped.
 */
export const checkDefaultModels = async (environment: Record<string, string | undefined>) => {
  const results: DefaultModelResult[] = [];
  for (const provider of environmentProviders) {
    const model = provider.defaultModel!;
    const variable = provider.environment.find(name => environment[name]?.trim());
    if (!variable) {
      results.push({ provider: provider.name, model, result: 'skipped', detail: 'no key' });
      continue;
    }
    const inference = createInferenceHandler({
      environment: { [variable]: environment[variable] },
      file: '',
    });
    const connection = inference.resolveConnection({})!;
    let tokens = 0;
    // Each round sends the real request and applies its result, as the demo does.
    const round = async (notes: Note[], turns: TranscriptTurn[], cursor: number) => {
      const { body } = createNotesRequest({
        notes,
        turns,
        cursor,
        connection: {
          model,
          maxBodyBytes: 65_536,
          maxOutputTokens: 2048,
          requestCompletion: async () => undefined,
        },
      });
      const outcome = await inference.complete({
        connection,
        body: JSON.parse(body) as Record<string, unknown>,
        allowFallback: false,
      });
      if (!outcome.ok) throw new Error(`${outcome.error.code}: ${outcome.error.message}`);
      const usage = readCompletionUsage(outcome.completion);
      tokens += usage.inputTokens + usage.outputTokens;
      return applyNotesResult({ notes, response: parseNotesCompletion(outcome.completion) });
    };
    const started = performance.now();
    try {
      const first = await round([], transcript, 0);
      if (!first.length) throw new Error('valid response with no notes');
      const second = await round(first, [...transcript, followUp], transcript.length);
      results.push({
        provider: provider.name,
        model,
        result: 'passed',
        detail: second
          .flatMap(note => [note.text, ...note.children.map(child => `  - ${child.text}`)])
          .join('\n        '),
        latencyMs: Math.round(performance.now() - started),
        tokens,
      });
    } catch (error) {
      results.push({
        provider: provider.name,
        model,
        result: 'failed',
        detail: describeFailure(error),
        latencyMs: Math.round(performance.now() - started),
        tokens,
      });
    }
  }
  return results;
};

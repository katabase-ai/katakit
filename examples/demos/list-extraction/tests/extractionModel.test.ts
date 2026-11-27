import { expect, test, vi } from 'vitest';
import {
  createExtractionRequest,
  defaultRules,
  readExtraction,
  type ExtractionConnection,
} from '../src/extractionModel';
import { sampleTurns } from '../src/sample';

const item = {
  listId: 'actions',
  text: 'Email Sam',
  kind: 'commitment',
  owner: null,
  deadline: 'Tomorrow',
  sources: [{ turnId: sampleTurns[0]!.id, quote: sampleTurns[0]!.text }],
};
const completion = (items: unknown[], finish_reason = 'stop') => ({
  choices: [{ finish_reason, message: { content: JSON.stringify({ items }) } }],
});

test('validates all source references atomically and rejects invented excerpts, lists and turns', () => {
  for (const bad of [
    { ...item, listId: 'unknown' },
    { ...item, sources: [{ turnId: 'unknown', quote: 'invented' }] },
    { ...item, sources: [{ turnId: sampleTurns[0]!.id, quote: 'Email Sam today.' }] },
    { ...item, sources: [] },
    { ...item, owner: 'An invented speaker' },
    { ...item, deadline: '2099-01-01' },
  ]) {
    const id = vi.fn(() => 'new-id');
    expect(() => readExtraction(completion([item, bad]), defaultRules, sampleTurns, id)).toThrow(
      /source|invalid list items/
    );
    expect(id).not.toHaveBeenCalled();
  }
});

test('quote mode displays the verified source instead of generated paraphrases', () => {
  const output = readExtraction(
    completion([item]),
    [{ ...defaultRules[0]!, wording: 'quote' }],
    sampleTurns
  );
  expect(output[0]!.text).toBe(`“${sampleTurns[0]!.text}”`);
  expect(output[0]!.sources[0]!.turnId).toBe(sampleTurns[0]!.id);
});

test('merges equivalent items within a list, retaining distinct source occurrences', () => {
  const turns = [...sampleTurns, { ...sampleTurns[0]!, id: 'repeat', startMs: 90000 }];
  const rules = [...defaultRules, { ...defaultRules[0]!, id: 'second' }];
  const output = readExtraction(
    completion([
      item,
      { ...item, sources: [{ turnId: 'repeat', quote: turns.at(-1)!.text }] },
      { ...item, listId: 'second' },
    ]),
    rules,
    turns
  );
  expect(output).toHaveLength(2);
  expect(output[0]!.sources).toHaveLength(2);
  expect(output[1]!.listId).toBe('second');
});

test('rejects truncated, malformed and invalid completions; an empty extraction is valid', () => {
  for (const response of [
    {},
    completion([item], 'length'),
    completion([item], 'tool_calls'),
    { choices: [{ finish_reason: 'stop', message: { content: '{' } }] },
    completion([{ ...item, kind: 'invented' }]),
  ])
    expect(() => readExtraction(response, defaultRules, sampleTurns)).toThrow(/model/i);
  expect(readExtraction(completion([]), defaultRules, sampleTurns)).toEqual([]);
});

test('wire sizing includes all instructions, schema and complete transcript without truncation', () => {
  const connection: ExtractionConnection = {
    model: 'test',
    maxBodyBytes: 100000,
    maxOutputTokens: 2048,
    requestCompletion: vi.fn(),
  };
  const body = createExtractionRequest(defaultRules, sampleTurns, connection);
  const parsed = JSON.parse(body);
  expect(JSON.parse(parsed.messages[1].content).transcript).toEqual(sampleTurns);
  expect(parsed.response_format.json_schema.strict).toBe(true);
  const bytes = new TextEncoder().encode(body).byteLength;
  expect(
    createExtractionRequest(defaultRules, sampleTurns, { ...connection, maxBodyBytes: bytes })
  ).toBe(body);
  expect(() =>
    createExtractionRequest(defaultRules, sampleTurns, { ...connection, maxBodyBytes: bytes - 1 })
  ).toThrow(/input limit/);
});

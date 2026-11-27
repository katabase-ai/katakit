import type { TranscriptTurn } from './extractionPlugin';
import type { ExtractedItem, ListRule } from './extractionModel';

/** An explicit fixture, never a substitute for model processing of a visitor's dictation. */
export const sampleTurns: TranscriptTurn[] = [
  {
    id: 'sample-email',
    sourceId: 'sample',
    startMs: 4000,
    endMs: 10000,
    text: 'I’ll email Sam the revised proposal tomorrow.',
  },
  {
    id: 'sample-aside',
    sourceId: 'sample',
    startMs: 10000,
    endMs: 15000,
    text: 'By the way, I finally found my headphones.',
  },
  {
    id: 'sample-decision',
    sourceId: 'sample',
    startMs: 16000,
    endMs: 25000,
    text: 'The decision is to support direct dictation in the first version.',
  },
  {
    id: 'sample-prototype',
    sourceId: 'sample',
    startMs: 26000,
    endMs: 33000,
    text: 'I’ll send the prototype around for feedback on Friday.',
  },
  {
    id: 'sample-question',
    sourceId: 'sample',
    startMs: 34000,
    endMs: 39000,
    text: 'Should lists update while I’m still speaking?',
  },
  {
    id: 'sample-idea',
    sourceId: 'sample',
    startMs: 40000,
    endMs: 46000,
    text: 'We could add a preset for customer interview feedback.',
  },
];
export const sampleItems = (rules: ListRule[]): ExtractedItem[] =>
  rules.flatMap(rule => {
    if (rule.instructions.trim()) return [];
    const indices = {
      'Action items': [0, 3],
      Commitments: [0, 3],
      Decisions: [2],
      Questions: [4],
      'Ideas and proposals': [5],
      'Specific mentions': [],
      Custom: [],
    }[rule.preset];
    return indices.map(index => {
      const turn = sampleTurns[index]!;
      const kind =
        index === 2
          ? 'decision'
          : index === 4
            ? 'question'
            : index === 5
              ? 'proposal'
              : 'commitment';
      const clean = [
        'Email Sam the revised proposal',
        '',
        'Support direct dictation in the first version',
        'Send the prototype for feedback',
        'Should lists update while the user is speaking?',
        'Add a preset for customer interview feedback',
      ][index]!;
      return {
        id: `sample-${rule.id}-${index}`,
        listId: rule.id,
        text: rule.wording === 'quote' ? `“${turn.text}”` : clean,
        kind,
        owner: null,
        deadline: index === 0 ? 'Tomorrow' : index === 3 ? 'Friday' : null,
        sources: [{ turnId: turn.id, quote: turn.text }],
        hidden: false,
      };
    });
  });

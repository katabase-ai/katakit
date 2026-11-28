import { EventLogPlugin, makeKatakitPlugin, property } from '@katakit/core';
import { filter, scan, startWith } from 'rxjs';
import * as v from 'valibot';
import { answerKey, findChallenge } from './challenges';
import { WordRushEventSchema, type WordRushEvent, type WordRushNote } from './events';
import { qualificationThreshold, type WordRushJudgment } from './wordRushModel';

export type WordRushContent = {
  roundId: string;
  challengeId: string;
  seconds: number | null;
  deadline: number | null;
  endedAt: number | null;
  phase: 'idle' | 'running' | 'finishing' | 'finished';
  notes: WordRushNote[];
  judgments: WordRushJudgment[];
  removed: string[];
  segments: { id: string; text: string }[];
  cursor: number;
};

const initial = (): WordRushContent => ({
  roundId: '',
  challengeId: 'animals-01',
  seconds: 60,
  deadline: null,
  endedAt: null,
  phase: 'idle',
  notes: [],
  judgments: [],
  removed: [],
  segments: [],
  cursor: 0,
});

const project = (state: WordRushContent, event: WordRushEvent): WordRushContent => {
  switch (event.type) {
    case 'started':
      return {
        ...initial(),
        challengeId: event.challengeId,
        seconds: event.seconds,
        roundId: event.roundId,
        deadline: event.deadline,
        phase: 'running',
      };
    case 'heard':
      return { ...state, segments: [...state.segments, { id: event.id, text: event.text }] };
    case 'judged':
      return {
        ...state,
        notes: [...state.notes, ...event.notes],
        judgments: [...state.judgments, ...event.judgments],
        cursor: event.cursor,
      };
    case 'removed': {
      const note = state.notes.find(note => note.id === event.id);
      return note
        ? {
            ...state,
            notes: state.notes.filter(note => note.id !== event.id),
            removed: [...state.removed, note.text],
          }
        : state;
    }
    case 'finishing':
      return { ...state, phase: 'finishing', endedAt: event.at };
    case 'finished':
      return { ...state, phase: 'finished' };
  }
};

/** Owns accepted Word Rush facts and projects board content; live resources stay with the visit. */
export const WordRushPlugin = makeKatakitPlugin({
  type: 'WordRush',
  configure: (_options: {}) => ({}),
  observables: ({ getObservables }) => ({
    content$: property(
      getObservables(EventLogPlugin).events$.pipe(
        filter((event): event is WordRushEvent =>
          ['started', 'heard', 'judged', 'removed', 'finishing', 'finished'].includes(event.type)
        ),
        scan(project, initial()),
        startWith(initial())
      )
    ),
  }),
  methods: ({ observables: { content$ }, getMethods }) => {
    const emit = (event: v.InferOutput<typeof WordRushEventSchema>) =>
      getMethods(EventLogPlugin).emitEvent(v.parse(WordRushEventSchema, event));
    return {
      startRound: (
        roundId: string,
        challengeId: string,
        seconds: number | null,
        deadline: number | null
      ) => {
        if (
          ['running', 'finishing'].includes(content$.get().phase) ||
          !findChallenge(challengeId) ||
          (seconds !== null && (!Number.isFinite(seconds) || seconds <= 0))
        )
          return;
        emit({ type: 'started', roundId, challengeId, seconds, deadline });
      },
      recordSegment: (id: string, text: string) => {
        // Capture may deliver a final segment after the deadline but before flush seals input.
        if (['running', 'finishing'].includes(content$.get().phase))
          emit({ type: 'heard', id, text });
      },
      recordJudgments: (judgments: WordRushJudgment[], cursor: number) => {
        const content = content$.get();
        const answers = judgments.filter(answer => answer.probability >= qualificationThreshold);
        const keys = new Set(
          [...content.notes.map(note => note.text), ...content.removed].map(answerKey)
        );
        const notes: WordRushNote[] = [];
        for (const answer of answers) {
          const key = answerKey(answer.text);
          if (!key || keys.has(key)) continue;
          keys.add(key);
          notes.push({ text: answer.text, evidence: answer.evidence, id: crypto.randomUUID() });
        }
        emit({ type: 'judged', notes, judgments, cursor });
        return { accepted: notes.length, qualified: answers.length };
      },
      removeNote: (id: string) => {
        if (content$.get().notes.some(note => note.id === id)) emit({ type: 'removed', id });
      },
      finishRound: (at: number) => {
        if (content$.get().phase === 'running') emit({ type: 'finishing', at });
      },
      completeRound: () => {
        if (['running', 'finishing'].includes(content$.get().phase)) emit({ type: 'finished' });
      },
    };
  },
});

import { EventLogPlugin, type KatakitEvent, makeKatakit } from '@katakit/core';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { makeTranscriptIngestionPlugin, type Utterance } from './index';

const create = (existingEvents: KatakitEvent[] = []) => {
  const transcript = makeTranscriptIngestionPlugin({ turnSilenceMs: 1000 });
  const kit = makeKatakit({ existingEvents, plugins: [transcript.configure({})] });
  return {
    state: kit.getObservables(transcript),
    history: kit.getObservables(EventLogPlugin).events$,
    start: () => kit.start().getMethods(transcript),
  };
};

const first: Utterance = { id: 'one', text: 'Good', speaker: 'mic', startMs: 10, endMs: 40 };
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test('records interim input and clears the current draft on an utterance or completed turn', () => {
  const { state, start, history } = create();
  const input = start();
  expect(state.pendingConversationTurn$.get()).toBeNull();
  expect(state.provisionalUtterance$.get()).toBeNull();
  input.updateProvisionalUtterance({ speaker: 'mic', text: 'Go' });
  expect(state.provisionalUtterance$.get()?.text).toBe('Go');
  input.ingestUtterance(first);
  expect(state.provisionalUtterance$.get()).toBeNull();
  vi.advanceTimersByTime(900);
  input.ingestUtterance({ ...first, id: 'two', text: 'morning', startMs: 50, endMs: 90 });
  input.updateProvisionalUtterance({ speaker: 'mic', text: 'next' });
  vi.advanceTimersByTime(999);
  expect(state.collectedConversationTurns$.get()).toEqual([]);
  const pending = { text: 'Good morning', startMs: 10, endMs: 90 };
  expect(state.pendingConversationTurn$.get()).toEqual(pending);
  vi.advanceTimersByTime(1);
  expect(state.collectedConversationTurns$.get()).toEqual([{ ...pending, id: expect.any(String) }]);
  expect(state.provisionalUtterance$.get()).toBeNull();
  expect(state.pendingConversationTurn$.get()).toBeNull();
  expect(history.getAll().map(e => e.type)).toEqual([
    'provisionalUtteranceAdded',
    'utteranceAdded',
    'utteranceAdded',
    'provisionalUtteranceAdded',
    'conversationTurnAdded',
  ]);
  input.close();
});

test('draining and the silence timer cannot complete the same pending turn twice', () => {
  const { start, state, history } = create();
  const input = start();
  input.ingestUtterance(first);
  input.flush();
  input.flush();
  vi.advanceTimersByTime(2000);
  expect(history.getAll().map(event => event.type)).toEqual([
    'utteranceAdded',
    'conversationTurnAdded',
  ]);
  expect(state.pendingConversationTurn$.get()).toBeNull();
});

test('reconstructs finalized and pending turns before start without rearming the live detector', () => {
  const live = create();
  const input = live.start();
  input.ingestUtterance(first);
  vi.advanceTimersByTime(1000);
  input.ingestUtterance({ ...first, id: 'two', text: 'Later' });
  input.close();
  const saved = live.history.getAll();
  const replay = create(saved);
  expect(replay.state.collectedUtterances$.get()).toEqual(live.state.collectedUtterances$.get());
  expect(replay.state.collectedConversationTurns$.get()).toEqual(
    live.state.collectedConversationTurns$.get()
  );
  expect(replay.state.pendingConversationTurn$.get()).toEqual(
    live.state.pendingConversationTurn$.get()
  );
  replay.start();
  vi.advanceTimersByTime(2000);
  expect(replay.history.getAll()).toEqual(saved);
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNotesDemo } from './createNotesDemo';
import { parseNotesHistory } from './notesEvents';
import { createTranscriptPreview } from './createTranscriptPreview';

afterEach(() => vi.useRealTimers());

const segment = (id: string, text: string) => ({ id, sourceId: 'mic', text });
const turn = { type: 'transcriptTurn', turn: segment('first', 'Original thought') };
const note = { id: 'n1', text: 'Original note', children: [] };

describe('notes history boundary', () => {
  it.each(
    [
      null,
      [{ ...turn, meta: { seq: 4, timestamp: new Date(0) } }],
      [{ ...turn, meta: { seq: 0, timestamp: 'not a date' } }],
      [{ ...turn, meta: { seq: -1, timestamp: new Date(0) } }],
      [{ type: 'unknown' }],
      [{ ...turn, turn: { id: 'first' } }],
      [turn, turn],
      [{ type: 'transcriptSegment', segment: segment('one', 'hello') }, turn],
      [
        { type: 'transcriptSegment', segment: segment('one', 'hello') },
        { type: 'transcriptSegment', segment: { ...segment('two', 'hello'), sourceId: 'other' } },
      ],
      [turn, { type: 'notesUpdated', notes: [note], cursor: 2 }],
      [turn, { type: 'notesCleared', cursor: 0 }],
      [turn, { type: 'notesUpdated', notes: [note, note], cursor: 1 }],
      [
        turn,
        { type: 'notesUpdated', notes: [note], cursor: 1 },
        { type: 'notesUpdated', notes: [], cursor: 0 },
      ],
      [
        { type: 'transcriptSegment', segment: segment('one', 'hello') },
        { type: 'transcriptSegment', segment: segment('one', 'hello') },
      ],
    ].map(history => [history])
  )('rejects invalid restored history before starting a runtime: %j', history => {
    expect(() => createNotesDemo({ initialEvents: history })).toThrow(/.+/);
  });

  it('parses a detached snapshot without changing recorded IDs', () => {
    const history = [turn, { type: 'notesUpdated', notes: [note], cursor: 1 }];
    const restored = parseNotesHistory(history);
    expect(restored).toEqual(
      history.map((event, seq) => ({ ...event, meta: { seq, timestamp: new Date(0) } }))
    );
    expect(restored[0]).not.toBe(history[0]);
  });
});

describe('notes transcript replay', () => {
  it('drains live input across source and speaker boundaries without inventing audio times', () => {
    vi.useFakeTimers();
    const runtime = createNotesDemo();
    runtime.ingestSegment({ id: 'one', sourceId: 'mic', speaker: 'Ada', text: 'First' });
    runtime.ingestSegment({ id: 'two', sourceId: 'mic', speaker: 'Ben', text: 'Second' });
    runtime.ingestSegment({
      id: 'three',
      sourceId: 'remote',
      speaker: 'Ben',
      text: 'Third',
      startMs: 20,
      endMs: 40,
    });
    runtime.close();
    runtime.close();
    expect(vi.getTimerCount()).toBe(0);
    const replay = createNotesDemo({
      initialEvents: JSON.parse(JSON.stringify(runtime.events$.getAll())),
    });
    expect(replay.transcript.conversationTurns$.get()).toEqual([
      { id: 'mic\0one', sourceId: 'mic', speaker: 'Ada', text: 'First' },
      { id: 'mic\0two', sourceId: 'mic', speaker: 'Ben', text: 'Second' },
      {
        id: 'remote\0three',
        sourceId: 'remote',
        speaker: 'Ben',
        text: 'Third',
        startMs: 20,
        endMs: 40,
      },
    ]);
    expect(replay.state$.get().turns).toEqual(replay.transcript.conversationTurns$.get());
    expect(replay.state$.get().notes.pendingTurnCount).toBe(3);
    replay.close();
  });
  it('validates live writes and continues core metadata after restored history', () => {
    const runtime = createNotesDemo({ initialEvents: [turn] });
    expect(() =>
      runtime.ingestSegment({ id: 'bad', sourceId: '', text: 'Invalid source' })
    ).toThrow(/length/);
    expect(runtime.events$.getAll()).toHaveLength(1);
    runtime.ingestSegment(segment('next', 'Continue'));
    runtime.flush();
    expect(runtime.events$.getAll().map(event => event.meta.seq)).toEqual([0, 1, 2]);
    const snapshot = JSON.parse(JSON.stringify(runtime.events$.getAll()));
    const restored = createNotesDemo({ initialEvents: snapshot });
    expect(restored.events$.getAll()).toEqual(runtime.events$.getAll());
    expect(restored.transcript.conversationTurns$.get()).toEqual(runtime.state$.get().turns);
    runtime.close();
    restored.close();
  });
  it('hydrates every finalized view, preserves pending segments and deduplicates continuation', () => {
    vi.useFakeTimers();
    const live = createNotesDemo();
    live.ingestSegment(segment('one', 'First idea'));
    live.flush();
    live.ingestSegment(segment('two', 'Second'));
    live.updateProvisional('transient draft');
    const history = JSON.parse(JSON.stringify(live.events$.getAll()));
    const beforeTimers = vi.getTimerCount();
    const replay = createNotesDemo({ initialEvents: history });
    const notifications = vi.fn();
    const previewLines = vi.fn();
    const stopPreview = createTranscriptPreview({
      events$: replay.transcriptEvents$,
      onLines: previewLines,
    });
    replay.transcriptEvents$.subscribe(notifications);
    expect(vi.getTimerCount()).toBe(beforeTimers);
    expect(replay.transcript.conversationTurns$.get()).toEqual(
      live.transcript.conversationTurns$.get()
    );
    expect(replay.transcript.segments$.get()).toEqual(live.transcript.segments$.get());
    expect(replay.transcript.currentTurn$.get()).toEqual(live.transcript.currentTurn$.get());
    expect(replay.state$.get().current).toEqual(live.state$.get().current);
    expect(replay.transcript.provisional$.get()).toBeUndefined();
    expect(replay.state$.get().turns).toEqual(replay.transcript.conversationTurns$.get());
    replay.ingestSegment(segment('one', 'First idea'));
    replay.ingestSegment(segment('two', 'Second'));
    expect(replay.events$.getAll()).toEqual(live.events$.getAll());
    expect(notifications).not.toHaveBeenCalled();
    expect(previewLines).not.toHaveBeenCalled();
    for (const runtime of [live, replay]) {
      runtime.ingestSegment(segment('three', 'idea'));
      runtime.flush();
    }
    expect(replay.events$.getAll()).toEqual(live.events$.getAll());
    expect(replay.state$.get().turns).toEqual(live.state$.get().turns);
    expect(replay.state$.get().turns[1]).toMatchObject({ id: 'mic\0two', text: 'Second idea' });
    expect(previewLines.mock.lastCall?.[0]).toEqual([expect.objectContaining({ text: 'idea' })]);
    stopPreview();
    live.close();
    replay.close();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('replay-only close does not finalize a restored pending turn or append events', () => {
    vi.useFakeTimers();
    const history = [{ type: 'transcriptSegment', segment: segment('pending', 'Still speaking') }];
    const replay = createNotesDemo({ initialEvents: history });
    expect(vi.getTimerCount()).toBe(0);
    replay.close();
    replay.close();
    replay.flush();
    replay.ingestSegment(segment('late', 'Too late'));
    expect(replay.events$.getAll()).toEqual(parseNotesHistory(history));
  });

  it('continues after a restored clear without reprocessing cleared turns', async () => {
    const runtime = createNotesDemo({ initialEvents: [turn, { type: 'notesCleared', cursor: 1 }] });
    const request = vi.fn().mockResolvedValue({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({ additions: [{ text: 'Fresh note' }], rewords: [] }),
          },
        },
      ],
    });
    runtime.notes.connect({
      model: 'test',
      maxBodyBytes: 16384,
      maxOutputTokens: 1024,
      requestCompletion: request,
    });
    await Promise.resolve();
    expect(request).not.toHaveBeenCalled();
    runtime.ingestSegment(segment('fresh', 'Fresh thought'));
    runtime.flush();
    await expect.poll(() => runtime.state$.get().notes.cursor).toBe(2);
    expect(request).toHaveBeenCalledOnce();
    expect(runtime.state$.get().markdown).toBe('- Fresh note');
    const replay = createNotesDemo({ initialEvents: runtime.events$.getAll() });
    expect(replay.state$.get()).toEqual(runtime.state$.get());
    expect(replay.transcript.conversationTurns$.get()).toEqual(runtime.state$.get().turns);
    runtime.close();
    replay.close();
  });
});

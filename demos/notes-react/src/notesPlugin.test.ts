import { afterEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { createNotesDemo } from './createNotesDemo';
import { NotesEventSchema } from './notesEvents';
import {
  createNotesRequest,
  NotesRequestError,
  NotesResultSchema,
  type NotesConnection,
} from './notesModel';

const setup = (
  requestNotes: NotesConnection['requestNotes'],
  reportFailure?: NotesConnection['reportFailure']
) => {
  const runtime = createNotesDemo();
  const methods = runtime.notes;
  const input = runtime;
  methods.connect({
    model: 'z-ai/glm-5.3',
    maxBodyBytes: 16_384,
    maxOutputTokens: 1024,
    requestNotes,
    reportFailure,
  });
  return {
    methods,
    input,
    runtime,
    state: { get: () => runtime.state$.get().notes },
    turn: (text: string, id: string = crypto.randomUUID()) => {
      input.ingestSegment({ sourceId: 'test', id, text });
      input.flush();
    },
    close: runtime.close,
  };
};

afterEach(() => vi.useRealTimers());

describe('structured notes', () => {
  it('replays accepted outlines, corrections and clears without generating IDs or model calls', async () => {
    const request = vi.fn<NotesConnection['requestNotes']>().mockResolvedValue({
      additions: [{ text: 'Meet **John** on Tuesday.' }],
      rewords: [],
    });
    const demo = setup(request);
    demo.turn('Meet John on Tuesday.');
    await expect.poll(() => demo.state.get().notes.length).toBe(1);
    const originalId = demo.state.get().notes[0]!.id;
    request.mockResolvedValue({
      additions: [{ text: 'Bring the agenda.', underId: originalId }],
      rewords: [{ id: originalId, text: 'Meet **Jon** on Tuesday.' }],
    });
    demo.turn('His name is Jon, J O N. Bring the agenda.');
    await expect.poll(() => demo.state.get().pendingTurnCount).toBe(0);
    const events = v.parse(
      v.array(NotesEventSchema),
      JSON.parse(JSON.stringify(demo.runtime.events$.getAll()))
    );
    const uuid = vi.spyOn(crypto, 'randomUUID');
    const replay = createNotesDemo({ initialEvents: events });
    expect(replay.state$.get().notes.notes).toEqual(demo.state.get().notes);
    expect(replay.state$.get().notes.notes[0]!.id).toBe(originalId);
    expect(replay.state$.get().markdown).toBe('- Meet **Jon** on Tuesday.\n  - Bring the agenda.');
    expect(replay.state$.get().turns).toHaveLength(2);
    expect(uuid).not.toHaveBeenCalled();
    const replayRequest = vi.fn();
    replay.notes.connect({
      model: 'test',
      maxBodyBytes: 16384,
      maxOutputTokens: 1024,
      requestNotes: replayRequest,
    });
    await Promise.resolve();
    expect(replayRequest).not.toHaveBeenCalled();
    replay.close();
    uuid.mockRestore();
    demo.methods.clear();
    const cleared = createNotesDemo({ initialEvents: demo.runtime.events$.getAll() });
    expect(cleared.state$.get().markdown).toBe('');
    expect(cleared.state$.get().notes.pendingTurnCount).toBe(0);
    expect(cleared.state$.get().turns).toHaveLength(2);
    cleared.close();
    demo.close();
  });

  it('does not record a late model response after closing the visit', async () => {
    const pending = Promise.withResolvers<unknown>();
    const request = vi.fn<NotesConnection['requestNotes']>().mockReturnValue(pending.promise);
    const demo = setup(request);
    demo.turn('Keep the captured turn.');
    await expect.poll(() => request.mock.calls.length).toBe(1);
    demo.close();
    const before = demo.runtime.events$.getAll();
    pending.resolve({ additions: [{ text: 'Too late' }], rewords: [] });
    await Promise.resolve();
    expect(demo.runtime.events$.getAll()).toEqual(before);
    expect(request.mock.calls[0]![0].signal.aborted).toBe(true);
  });

  it('retains a long replayed transcript and waits for admission before processing pending turns', async () => {
    const runtime = createNotesDemo({
      initialEvents: Array.from({ length: 12 }, (_, index) => ({
        type: 'transcriptTurn',
        turn: { id: String(index), sourceId: 'test', text: `Retain idea ${index}.` },
      })),
    });
    await Promise.resolve();
    expect(runtime.state$.get().notes.pendingTurnCount).toBe(12);
    expect(runtime.events$.getAll()).toHaveLength(12);
    const request = vi
      .fn<NotesConnection['requestNotes']>()
      .mockResolvedValue({ additions: [], rewords: [] });
    runtime.notes.connect({
      model: 'test',
      maxBodyBytes: 16384,
      maxOutputTokens: 1024,
      requestNotes: request,
    });
    await expect.poll(() => runtime.state$.get().notes.pendingTurnCount).toBe(0);
    expect(request).toHaveBeenCalledOnce();
    for (let index = 0; index < 12; index++)
      expect(request.mock.calls[0]![0].body).toContain(`Retain idea ${index}.`);
    expect(runtime.state$.get().turns).toHaveLength(12);
    runtime.close();
  });

  it('starts on a finalized turn, retains turns received in flight, and rewords the original note', async () => {
    const pending = Promise.withResolvers<unknown>();
    const request = vi.fn<NotesConnection['requestNotes']>().mockReturnValueOnce(pending.promise);
    const demo = setup(request);
    demo.input.updateProvisional('Meet John');
    await Promise.resolve();
    expect(request).not.toHaveBeenCalled();
    demo.turn('Meet John on Tuesday.', 'first');
    await expect.poll(() => request.mock.calls.length).toBe(1);
    demo.turn('His name is Jon. J O N.', 'second');
    demo.turn('His name is Jon. J O N.', 'second');
    request.mockImplementation(async () => ({
      additions: [],
      rewords: [{ id: demo.state.get().notes[0]!.id, text: 'Meet Jon on Tuesday.' }],
    }));
    pending.resolve({ additions: [{ text: 'Meet John on Tuesday.' }], rewords: [] });
    await expect.poll(() => demo.state.get().notes[0]?.text).toBe('Meet Jon on Tuesday.');
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]![0].body).toContain('J O N');
    expect(demo.state.get().notes).toHaveLength(1);
    expect(demo.state.get().pendingTurnCount).toBe(0);
    demo.close();
  });

  it('discards a late response after clear and continues with only later turns', async () => {
    const pending = Promise.withResolvers<unknown>();
    const request = vi
      .fn<NotesConnection['requestNotes']>()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue({ additions: [{ text: 'New topic' }], rewords: [] });
    const demo = setup(request);
    demo.turn('Old topic');
    await expect.poll(() => request.mock.calls.length).toBe(1);
    demo.methods.clear();
    expect(request.mock.calls[0]![0].signal.aborted).toBe(true);
    demo.turn('New topic');
    pending.resolve({ additions: [{ text: 'Old topic' }], rewords: [] });
    await expect.poll(() => demo.state.get().notes[0]?.text).toBe('New topic');
    expect(demo.state.get().notes).toHaveLength(1);
    demo.close();
  });

  it('retries a busy request after silence, then pauses exhausted requests despite new turns', async () => {
    const request = vi
      .fn<NotesConnection['requestNotes']>()
      .mockRejectedValueOnce(new NotesRequestError('Busy', { retryAfterMs: 1, retryLimit: 3 }))
      .mockRejectedValue(new NotesRequestError('Allowance exhausted', { terminal: true }));
    const demo = setup(request);
    demo.turn('A useful idea');
    await expect.poll(() => demo.state.get().status).toBe('paused');
    expect(request).toHaveBeenCalledTimes(2);
    demo.turn('Another useful idea');
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(2);
    await expect.poll(() => demo.state.get().pendingTurnCount).toBe(2);
    demo.methods.clear();
    demo.turn('Clearing cannot restore allowance');
    await expect.poll(() => demo.state.get().pendingTurnCount).toBe(1);
    expect(demo.state.get().status).toBe('paused');
    expect(request).toHaveBeenCalledTimes(2);
    demo.close();
  });

  it.each([
    ['notes_schema', { additions: 'invalid' }],
    [
      'notes_target',
      {
        additions: [{ text: 'Valid note' }, { text: 'Missing parent', underId: 'missing' }],
        rewords: [],
      },
    ],
    [
      'notes_target',
      { additions: [{ text: 'Valid note' }], rewords: [{ id: 'missing', text: 'Missing note' }] },
    ],
  ])(
    'keeps invalid output pending without repairing it in a paid retry loop: %j',
    async (code, response) => {
      const request = vi.fn<NotesConnection['requestNotes']>().mockResolvedValue(response);
      const reportFailure = vi.fn();
      const demo = setup(request, reportFailure);
      demo.turn('Keep this pending');
      await expect.poll(() => demo.state.get().status).toBe('paused');
      expect(demo.state.get().pendingTurnCount).toBe(1);
      expect(demo.state.get().notes).toEqual([]);
      expect(request).toHaveBeenCalledOnce();
      expect(reportFailure).toHaveBeenCalledWith(expect.objectContaining({ policy: { code } }));
      demo.close();
    }
  );

  it('keeps blank-note validation out of the provider grammar', () => {
    const { body } = createNotesRequest({
      notes: [],
      turns: [{ id: 'first', sourceId: 'test', text: 'Meet John on Tuesday.' }],
      cursor: 0,
      connection: {
        model: 'z-ai/glm-5.3',
        maxBodyBytes: 16_384,
        maxOutputTokens: 1024,
        requestNotes: vi.fn(),
      },
    });
    expect(JSON.parse(body).response_format.json_schema.schema).not.toHaveProperty(
      'properties.additions.items.properties.text.pattern'
    );
    expect(JSON.parse(body).response_format.json_schema.schema).not.toHaveProperty(
      'properties.rewords.items.properties.text.pattern'
    );
    expect(
      v.safeParse(NotesResultSchema, { additions: [{ text: ' \n' }], rewords: [] }).success
    ).toBe(false);
    expect(
      v.safeParse(NotesResultSchema, { additions: [], rewords: [{ id: 'first', text: ' \n' }] })
        .success
    ).toBe(false);
  });

  it('does not report a later context-limit failure against the preceding request', async () => {
    const request = vi.fn<NotesConnection['requestNotes']>().mockResolvedValue({
      additions: [{ text: 'Keep the successful note' }],
      rewords: [],
    });
    const reportFailure = vi.fn();
    const demo = setup(request, reportFailure);
    demo.turn('A useful idea');
    await expect.poll(() => demo.state.get().notes.length).toBe(1);
    demo.turn('語'.repeat(6000));
    await expect.poll(() => demo.state.get().status).toBe('paused');
    expect(demo.state.get().failure?.message).toContain('context limit');
    expect(demo.state.get().pendingTurnCount).toBe(1);
    expect(request).toHaveBeenCalledOnce();
    expect(reportFailure).not.toHaveBeenCalled();
    demo.close();
  });

  it('fits the complete UTF-8 wire body without dropping pending turns', () => {
    const connection = {
      model: 'z-ai/glm-5.3',
      maxBodyBytes: 16_384,
      maxOutputTokens: 1024,
      requestNotes: vi.fn(),
    };
    const turns = [0, 1, 2].map(index => ({
      id: String(index),
      sourceId: 'test',
      text: '語'.repeat(2000),
    }));
    const request = createNotesRequest({ notes: [], turns, cursor: 0, connection });
    expect(new TextEncoder().encode(request.body).byteLength).toBeLessThanOrEqual(
      connection.maxBodyBytes
    );
    expect(request.end).toBeLessThan(turns.length);
    expect(() =>
      createNotesRequest({
        notes: [],
        turns,
        cursor: 0,
        connection: { ...connection, maxBodyBytes: 100 },
      })
    ).toThrow('context limit');
  });
});

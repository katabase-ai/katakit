import { expect, test } from 'vitest';
import { applyNotesResult } from './applyNotesResult';
import type { Note } from './notesModel';

test('corrections and additions preserve recorded outlines and existing note IDs', () => {
  const notes: Note[] = [
    {
      id: 'meeting',
      text: 'Meet John.',
      children: [{ id: 'guest', text: 'Invite Ann.' }],
    },
  ];
  const recorded = structuredClone(notes);
  for (const note of notes) {
    note.children.forEach(Object.freeze);
    Object.freeze(note.children);
    Object.freeze(note);
  }
  Object.freeze(notes);

  const updated = applyNotesResult({
    notes,
    response: {
      additions: [{ text: 'Bring the agenda.', underId: 'meeting' }, { text: 'Ship on Friday.' }],
      rewords: [
        { id: 'meeting', text: 'Meet Jon.' },
        { id: 'guest', text: 'Invite Anne.' },
      ],
    },
  });

  expect(notes).toEqual(recorded);
  expect(updated).toEqual([
    {
      id: 'meeting',
      text: 'Meet Jon.',
      children: [
        { id: 'guest', text: 'Invite Anne.' },
        { id: expect.any(String), text: 'Bring the agenda.' },
      ],
    },
    { id: expect.any(String), text: 'Ship on Friday.', children: [] },
  ]);
  const ids = updated.flatMap(note => [note.id, ...note.children.map(child => child.id)]);
  expect(new Set(ids).size).toBe(4);
});

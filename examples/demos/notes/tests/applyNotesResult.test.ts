import { expect, test } from 'vitest';
import { applyNotesResult } from '../src/applyNotesResult';
import type { Note } from '../src/notesModel';

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

test('a misused ID costs one placement or correction, never the whole update', () => {
  const notes: Note[] = [
    { id: 'trip', text: 'Trip to Japan', children: [{ id: 'flights', text: 'Book flights' }] },
  ];
  const updated = applyNotesResult({
    notes,
    response: {
      additions: [
        { text: 'Window seat', underId: 'flights' },
        { text: 'Hotel in Kyoto', underId: 'invented' },
      ],
      rewords: [{ id: 'invented', text: 'Ignored' }],
    },
  });
  expect(updated).toEqual([
    {
      id: 'trip',
      text: 'Trip to Japan',
      children: [
        { id: 'flights', text: 'Book flights' },
        { id: expect.any(String), text: 'Window seat' },
      ],
    },
    { id: expect.any(String), text: 'Hotel in Kyoto', children: [] },
  ]);
});

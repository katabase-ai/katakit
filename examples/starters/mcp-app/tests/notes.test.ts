import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNotes } from '../src/notes';

test('Katakit emits state for supplied sample text and rejects blank input', () => {
  const notes = createNotes();
  const observed: string[][] = [];
  const subscription = notes.notes$.subscribe(value => observed.push([...value]));
  try {
    notes.add('  A note supplied by the card  ');
    assert.deepEqual(notes.notes$.get(), ['A note supplied by the card']);
    assert.deepEqual(observed, [[], ['A note supplied by the card']]);
    assert.throws(() => notes.add('  '), /Enter a note/);
    assert.deepEqual(notes.notes$.get(), ['A note supplied by the card']);
  } finally {
    subscription.unsubscribe();
    notes.close();
  }
});

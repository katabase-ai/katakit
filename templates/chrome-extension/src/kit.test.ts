import { afterAll, expect, test } from 'vitest';
import { addText, clearText, closeKit, turns$ } from './kit';

afterAll(closeKit);

test('typed text becomes a completed Katakit turn and reset clears it', () => {
  const snapshots: string[][] = [];
  const subscription = turns$.subscribe(turns => snapshots.push(turns));
  addText('  Hello from the extension  ');
  expect(snapshots.at(-1)).toEqual(['Hello from the extension']);
  clearText();
  expect(snapshots.at(-1)).toEqual([]);
  subscription.unsubscribe();
});

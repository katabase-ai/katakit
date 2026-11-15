import { expect, it } from 'vitest';
import { createWhisperChunks } from './whisperChunks';

it('keeps partial audio in order and drains it on stop', () => {
  const chunks = createWhisperChunks(4);
  expect(chunks.push(Float32Array.from([1, 2, 3]))).toEqual([]);
  expect(chunks.push(Float32Array.from([4, 5, 6]))).toEqual([Float32Array.from([1, 2, 3, 4])]);
  expect(chunks.flush()).toEqual(Float32Array.from([5, 6]));
  expect(chunks.flush()).toBeUndefined();
});

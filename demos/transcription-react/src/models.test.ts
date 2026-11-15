import { describe, expect, it } from 'vitest';
import { defaultModel, models, moonshineArchitecture } from './models';
import { createWhisperChunks } from './whisperChunks';

describe('transcription model choices', () => {
  it('defaults to Small and offers only published English streaming Moonshine variants', () => {
    expect(defaultModel).toBe('moonshine-small');
    expect(models.map(model => model.id)).toEqual([
      'moonshine-tiny',
      'moonshine-small',
      'moonshine-medium',
      'whisper-tiny',
    ]);
    expect([
      moonshineArchitecture('moonshine-tiny'),
      moonshineArchitecture('moonshine-small'),
      moonshineArchitecture('moonshine-medium'),
    ]).toEqual([2, 4, 5]);
  });

  it('cuts contiguous Whisper audio into chunks and flushes the final partial chunk', () => {
    const chunks = createWhisperChunks(4);
    expect(chunks.push(new Float32Array([1, 2, 3]))).toEqual([]);
    expect(chunks.push(new Float32Array([4, 5, 6, 7, 8, 9]))).toEqual([
      new Float32Array([1, 2, 3, 4]),
      new Float32Array([5, 6, 7, 8]),
    ]);
    expect(chunks.flush()).toEqual(new Float32Array([9]));
    expect(chunks.flush()).toBeUndefined();
  });
});

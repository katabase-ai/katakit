import { describe, expect, it } from 'vitest';
import { defaultModel, models } from '../src/models';

describe('transcription model choices', () => {
  it('defaults to Small and offers only published English streaming Moonshine variants', () => {
    expect(defaultModel).toBe('moonshine-small');
    expect(models.map(model => model.id)).toEqual([
      'moonshine-tiny',
      'moonshine-small',
      'moonshine-medium',
      'whisper-tiny',
    ]);
  });
});

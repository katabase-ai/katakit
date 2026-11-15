import { describe, expect, it } from 'vitest';
import { audioLevel, createAudioLevelReporter } from './audioLevel';

describe('microphone activity', () => {
  it('ignores silence and bounds loud audio', () => {
    expect(audioLevel(new Float32Array(512))).toBe(0);
    expect(audioLevel(new Float32Array(512).fill(0.5))).toBe(1);
    expect(audioLevel(new Float32Array(512).fill(0.03))).toBeGreaterThan(0);
  });
  it('reports after enough samples rather than on every worklet buffer', () => {
    const levels: number[] = [];
    const report = createAudioLevelReporter(level => levels.push(level), 16_000);
    report(new Float32Array(800).fill(0.03));
    expect(levels).toEqual([]);
    report(new Float32Array(800).fill(0.03));
    expect(levels).toHaveLength(1);
    expect(levels[0]).toBeGreaterThan(0);
    report(new Float32Array(1600));
    expect(levels[1]).toBe(0);
  });
});

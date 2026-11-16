/** Map microphone PCM to a readable 0–1 activity level (not a calibrated dB meter). */
export const audioLevel = (samples: Float32Array) => {
  if (!samples.length) return 0;
  let energy = 0;
  for (const sample of samples) energy += sample * sample;
  const rms = Math.sqrt(energy / samples.length);
  return Math.min(1, Math.max(0, (rms - 0.003) / 0.12));
};

/** Batch worklet buffers so React and extension messages update roughly 10 times a second. */
export const createAudioLevelReporter = (onLevel: (level: number) => void, sampleRate: number) => {
  let energy = 0;
  let count = 0;
  const windowSize = sampleRate / 10;
  return (samples: Float32Array) => {
    for (const sample of samples) energy += sample * sample;
    count += samples.length;
    if (count < windowSize) return;
    onLevel(Math.min(1, Math.max(0, (Math.sqrt(energy / count) - 0.003) / 0.12)));
    energy = 0;
    count = 0;
  };
};

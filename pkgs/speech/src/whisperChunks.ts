/** Accumulate 16 kHz PCM into contiguous chunks without dropping partial worklet buffers. */
export const createWhisperChunks = (size = 160_000) => {
  let pending: Float32Array[] = [];
  let count = 0;
  const take = (length: number) => {
    const audio = new Float32Array(length);
    let written = 0;
    while (written < length) {
      const first = pending[0]!;
      const used = Math.min(first.length, length - written);
      audio.set(first.subarray(0, used), written);
      written += used;
      if (used === first.length) pending.shift();
      else pending[0] = first.subarray(used);
    }
    count -= length;
    return audio;
  };
  return {
    push: (audio: Float32Array) => {
      pending.push(audio);
      count += audio.length;
      const ready: Float32Array[] = [];
      const fullChunks = Math.floor(count / size);
      for (let index = 0; index < fullChunks; index++) ready.push(take(size));
      return ready;
    },
    flush: () => (count ? take(count) : undefined),
  };
};

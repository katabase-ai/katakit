/** Batch resampled PCM to avoid posting a worker message for every worklet frame. */
export const createPcmChunks = (size = 1_600) => {
  let buffers: Float32Array[] = [];
  let count = 0;
  const take = (length: number) => {
    const out = new Float32Array(length);
    let written = 0;
    while (written < length) {
      const first = buffers[0]!;
      const used = Math.min(first.length, length - written);
      out.set(first.subarray(0, used), written);
      written += used;
      if (used === first.length) buffers.shift();
      else buffers[0] = first.subarray(used);
    }
    count -= length;
    return out;
  };
  return {
    push: (audio: Float32Array) => {
      buffers.push(audio);
      count += audio.length;
      const ready: Float32Array[] = [];
      const fullChunks = Math.floor(count / size);
      for (let index = 0; index < fullChunks; index++) ready.push(take(size));
      return ready;
    },
    flush: () => (count ? take(count) : undefined),
  };
};

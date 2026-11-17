class PcmWorklet extends AudioWorkletProcessor {
  process(inputs) {
    const channels = inputs[0];
    if (channels?.[0]) this.port.postMessage(new Float32Array(channels[0]));
    return true;
  }
}
registerProcessor('katakit-pcm', PcmWorklet);

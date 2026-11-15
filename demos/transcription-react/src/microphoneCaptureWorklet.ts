export type MicrophoneCaptureMessage =
  | { type: 'audio'; samples: Float32Array }
  | { type: 'flushed' };

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare const registerProcessor: (name: string, processor: typeof AudioWorkletProcessor) => void;

// Ported from protozoa-app: batch 32ms of mono input and flush the final partial buffer.
class MicrophoneCaptureProcessor extends AudioWorkletProcessor {
  samples = new Float32Array(512);
  used = 0;

  constructor() {
    super();
    this.port.onmessage = () => {
      this.emit();
      this.port.postMessage({ type: 'flushed' } satisfies MicrophoneCaptureMessage);
    };
  }

  emit = () => {
    if (!this.used) return;
    const samples = this.samples.slice(0, this.used);
    this.port.postMessage({ type: 'audio', samples } satisfies MicrophoneCaptureMessage, [
      samples.buffer,
    ]);
    this.used = 0;
  };

  process = (inputs: Float32Array[][]) => {
    const input = inputs[0]?.[0];
    if (input) {
      for (const sample of input) {
        this.samples[this.used++] = sample;
        if (this.used === this.samples.length) this.emit();
      }
    }
    return true;
  };
}

registerProcessor('katakit-microphone-capture', MicrophoneCaptureProcessor);

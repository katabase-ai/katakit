/** Host-only capture. Consumers receive 16 kHz mono samples, never browser APIs. */
export const createCapture = (
  onSamples: (samples: Float32Array) => void,
  onMicSamples?: (samples: Float32Array) => void
) => {
  let tab: MediaStream | undefined;
  let mic: MediaStream | undefined;
  let context: AudioContext | undefined;
  let processor: AudioWorkletNode | undefined;
  let sink: GainNode | undefined;
  let micMeter: ReturnType<typeof setInterval> | undefined;
  let position = 0;
  let previous = 0;

  const stop = async () => {
    if (micMeter) clearInterval(micMeter);
    micMeter = undefined;
    processor?.disconnect();
    processor?.port.close();
    sink?.disconnect();
    tab?.getTracks().forEach(track => track.stop());
    mic?.getTracks().forEach(track => track.stop());
    await context?.close();
    tab = mic = undefined;
    context = undefined;
    processor = undefined;
    sink = undefined;
  };

  return {
    start: async (streamId: string) => {
      try {
        tab = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId },
          } as MediaTrackConstraints,
        });
        try {
          mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          // A denied mic must not prevent tab-only capture.
        }
        context = new AudioContext();
        await context.audioWorklet.addModule(chrome.runtime.getURL('pcm-worklet.js'));
        processor = new AudioWorkletNode(context, 'katakit-pcm');
        sink = context.createGain();
        sink.gain.value = 0;
        const tabSource = context.createMediaStreamSource(tab);
        tabSource.connect(processor);
        // tabCapture mutes the tab: route it back to the speakers, but do not play the mic.
        tabSource.connect(context.destination);
        if (mic) {
          const micSource = context.createMediaStreamSource(mic);
          micSource.connect(processor);
          if (onMicSamples) {
            const analyser = context.createAnalyser();
            analyser.fftSize = 2048;
            micSource.connect(analyser);
            const samples = new Float32Array(analyser.fftSize);
            micMeter = setInterval(() => {
              if (context?.state === 'running') {
                analyser.getFloatTimeDomainData(samples);
                onMicSamples(samples);
              }
            }, 100);
          }
        }
        processor.connect(sink).connect(context.destination);
        position = 0;
        previous = 0;
        const ratio = context.sampleRate / 16_000;
        processor.port.onmessage = ({ data }: MessageEvent<Float32Array>) => {
          const out: number[] = [];
          // Preserve the fractional source position across worklet buffers.
          const end = previous + data.length;
          while (position < end) {
            const index = Math.max(0, Math.floor(position - previous));
            out.push(data[index] ?? 0);
            position += ratio;
          }
          previous = end;
          if (out.length) onSamples(Float32Array.from(out));
        };
        if (context.state === 'suspended') await context.resume();
        return { micConnected: !!mic };
      } catch (error) {
        await stop();
        throw error;
      }
    },
    stop,
  };
};

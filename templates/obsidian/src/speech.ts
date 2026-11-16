import {
  AutoModelForSpeechSeq2Seq,
  AutoProcessor,
  AutoTokenizer,
  AutomaticSpeechRecognitionPipeline,
  env,
} from '@xenova/transformers';

// Obsidian's renderer is not cross-origin isolated: use single-threaded Whisper.
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
const MODEL = 'Xenova/whisper-tiny.en';

export const createShortClipTranscriber = (callbacks: {
  status(message: string): void;
  final(text: string): void;
  error?(message: string): void;
}) => {
  let recognizer: AutomaticSpeechRecognitionPipeline | undefined;
  let loading: Promise<void> | undefined;
  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  let pending: Promise<void> | undefined;
  let closed = false;

  const load = () => {
    if (closed) throw new Error('Transcriber closed');
    loading ??= (async () => {
      try {
        callbacks.status('Downloading / loading Whisper Tiny (first use needs internet)…');
        const progress_callback = (event: { progress?: number }) => {
          if (typeof event.progress === 'number')
            callbacks.status(`Loading model: ${Math.floor(event.progress)}%`);
        };
        const model = await AutoModelForSpeechSeq2Seq.from_pretrained(MODEL, {
          quantized: true,
          progress_callback,
        });
        const tokenizer = await AutoTokenizer.from_pretrained(MODEL, { progress_callback });
        const processor = await AutoProcessor.from_pretrained(MODEL, { progress_callback });
        const next = new AutomaticSpeechRecognitionPipeline({
          task: 'automatic-speech-recognition',
          model,
          tokenizer,
          processor,
        });
        if (closed) await next.dispose();
        else recognizer = next;
      } catch (error) {
        loading = undefined; // Let a later user gesture retry a failed download.
        throw error;
      }
    })();
    return loading;
  };

  const start = async () => {
    if (recorder || pending) throw new Error('Finish the current recording first.');
    await load();
    if (closed) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
      throw new Error('Microphone or MediaRecorder is unavailable in Obsidian Desktop.');
    callbacks.status('Requesting microphone…');
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (closed) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    const chunks: Blob[] = [];
    try {
      recorder = new MediaRecorder(stream);
    } catch (error) {
      stream.getTracks().forEach(track => track.stop());
      stream = undefined;
      throw error;
    }
    recorder.addEventListener('dataavailable', event => {
      if (event.data.size) chunks.push(event.data);
    });
    const current = recorder;
    let recordingFailed = false;
    pending = new Promise<void>((resolve, reject) => {
      current.addEventListener(
        'error',
        () => {
          recordingFailed = true;
          callbacks.error?.('Audio recording failed. Check Obsidian’s microphone permission.');
          stream?.getTracks().forEach(track => track.stop());
          stream = undefined;
          recorder = undefined;
          try {
            if (current.state === 'recording') current.stop();
          } catch {
            // The rejected promise already reports the recording error.
          }
          reject(new Error('Audio recording failed.'));
        },
        { once: true }
      );
      current.addEventListener(
        'stop',
        () => {
          void (async () => {
            try {
              const tracks = stream;
              stream = undefined;
              tracks?.getTracks().forEach(track => track.stop());
              recorder = undefined;
              if (closed) {
                resolve();
                return;
              }
              if (recordingFailed) throw new Error('Audio recording failed.');
              if (!chunks.length) throw new Error('No audio captured.');
              callbacks.status('Decoding audio…');
              const bytes = await new Blob(chunks, { type: current.mimeType }).arrayBuffer();
              const context = new AudioContext();
              try {
                const decoded = await context.decodeAudioData(bytes);
                const offline = new OfflineAudioContext(
                  1,
                  Math.ceil(decoded.duration * 16_000),
                  16_000
                );
                const source = offline.createBufferSource();
                source.buffer = decoded;
                source.connect(offline.destination);
                source.start();
                const audio = (await offline.startRendering()).getChannelData(0);
                callbacks.status('Transcribing short clip…');
                const result = await recognizer!(audio, { top_k: 0, do_sample: false });
                if (!closed) {
                  const text = Array.isArray(result)
                    ? result.map(line => line.text).join(' ')
                    : result.text;
                  callbacks.final(text);
                  callbacks.status('Done. Audio and transcript are not saved.');
                }
              } finally {
                await context.close();
              }
              resolve();
            } catch (error) {
              reject(error);
            }
          })();
        },
        { once: true }
      );
    });
    // Spontaneous MediaRecorder errors can precede a Stop click.
    void (async () => {
      try {
        await pending;
      } catch {
        // The view reports recorder errors; Stop still observes the rejection.
      }
    })();
    try {
      current.start();
    } catch (error) {
      // No stop event follows a failed start; settle the pending promise and release tracks.
      current.dispatchEvent(new Event('stop'));
      await pending.catch(() => {});
      pending = undefined;
      throw error;
    }
    callbacks.status('Recording… Click Stop to transcribe.');
  };

  const stop = async () => {
    if (recorder?.state === 'recording') recorder.stop();
    try {
      await pending;
    } finally {
      pending = undefined;
    }
  };
  return {
    start,
    stop,
    dispose: async () => {
      closed = true;
      try {
        await stop();
      } finally {
        stream?.getTracks().forEach(track => track.stop());
        await loading?.catch(() => {});
        await recognizer?.dispose();
        recognizer = undefined;
      }
    },
  };
};

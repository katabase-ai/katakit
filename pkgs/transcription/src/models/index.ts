import { createTranscriber } from '@katakit/speech';
import { moonshine, type MoonshineOptions as Moonshine } from '@katakit/speech/moonshine';
import { whisper, type WhisperOptions as Whisper } from '@katakit/speech/whisper';
import type { SpeechCallbacks, SpeechState } from '@katakit/speech';
export type {
  SpeechCallbacks as TranscriptionCallbacks,
  Transcriber as TranscriptionModel,
} from '@katakit/speech';
export type MoonshineOptions = Moonshine & { provider: 'moonshine' };
export type WhisperOptions = Whisper & { provider: 'whisper' };
export const createTranscriptionModel = (
  options: (MoonshineOptions | WhisperOptions) & SpeechCallbacks
) => {
  const model = createTranscriber({
    ...options,
    engine: options.provider === 'moonshine' ? moonshine(options) : whisper(options),
  });
  return { ...model, start: (sourceId?: string) => model.start({ sourceId }) };
};

export type ModelState = Omit<SpeechState, 'error'> & { error?: string };

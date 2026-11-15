export type SpeechErrorCode =
  | 'unsupported-environment'
  | 'cross-origin-isolation-required'
  | 'microphone-permission-denied'
  | 'microphone-unavailable'
  | 'audio-format-unsupported'
  | 'model-load-failed'
  | 'recognition-failed'
  | 'disposed';

export class SpeechError extends Error {
  constructor(
    readonly code: SpeechErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'SpeechError';
  }
}

export const speechError = (error: unknown, code: SpeechErrorCode) =>
  error instanceof SpeechError
    ? error
    : new SpeechError(code, error instanceof Error ? error.message : String(error), {
        cause: error,
      });

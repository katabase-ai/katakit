export type TranscriptionErrorCode =
  | 'unsupported-environment'
  | 'cross-origin-isolation-required'
  | 'microphone-permission-denied'
  | 'microphone-unavailable'
  | 'audio-format-unsupported'
  | 'model-load-failed'
  | 'recognition-failed'
  | 'disposed';

export class TranscriptionError extends Error {
  constructor(
    readonly code: TranscriptionErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TranscriptionError';
  }
}

export const transcriptionError = (error: unknown, code: TranscriptionErrorCode) =>
  error instanceof TranscriptionError
    ? error
    : new TranscriptionError(code, error instanceof Error ? error.message : String(error), {
        cause: error,
      });

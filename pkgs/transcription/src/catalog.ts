export const transcriptionModels = [
  { id: 'moonshine-tiny', label: 'Moonshine Tiny Streaming', provisional: true, language: 'en' },
  { id: 'moonshine-small', label: 'Moonshine Small Streaming', provisional: true, language: 'en' },
  {
    id: 'moonshine-medium',
    label: 'Moonshine Medium Streaming',
    provisional: true,
    language: 'en',
  },
  { id: 'whisper-tiny', label: 'Whisper Tiny English', provisional: false, language: 'en' },
] as const;

export type TranscriptionModelId = (typeof transcriptionModels)[number]['id'];

export const defaultTranscriptionModel: TranscriptionModelId = 'moonshine-small';

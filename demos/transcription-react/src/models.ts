export const models = [
  { id: 'moonshine-tiny', label: 'Moonshine Tiny Streaming', detail: 'Live transcription' },
  { id: 'moonshine-small', label: 'Moonshine Small Streaming', detail: 'Live transcription' },
  { id: 'moonshine-medium', label: 'Moonshine Medium Streaming', detail: 'Live transcription' },
  {
    id: 'whisper-tiny',
    label: 'Whisper Tiny English',
    detail: '10-second chunks; no live preview',
  },
] as const;

export type ModelId = (typeof models)[number]['id'];
export const defaultModel: ModelId = 'moonshine-small';

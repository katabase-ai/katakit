import { transcriptionModels, type TranscriptionModelId } from '@katakit/transcription/browser';
export const models = transcriptionModels.map(model => ({
  ...model,
  detail: model.provisional ? 'Live transcription' : '10-second chunks; no live preview',
}));
export type ModelId = TranscriptionModelId;
export const defaultModel: ModelId = 'moonshine-small';

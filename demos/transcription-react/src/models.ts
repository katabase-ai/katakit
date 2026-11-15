import { speechModels, type SpeechModelId } from '@katakit/speech/browser';
export const models = speechModels.map(model => ({
  ...model,
  detail: model.provisional ? 'Live transcription' : '10-second chunks; no live preview',
}));
export type ModelId = SpeechModelId;
export const defaultModel: ModelId = 'moonshine-small';

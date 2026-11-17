export type GalleryDeveloperPage = 'setup' | 'grid';
export type GalleryOperation = 'transcription' | 'inference';

/** Only implemented operations belong in setup/readiness. Capability metadata also drives the grid. */
export const galleryOperations = [
  { id: 'transcription', title: 'Transcription', group: 'Audio', capability: 'localTranscription' },
  { id: 'inference', title: 'Inference', group: 'Language', capability: 'remoteModel' },
] as const;

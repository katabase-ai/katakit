/** Declared behavior, independent of model downloads, connections, or active capture. */
export type GalleryDataHandling = {
  readonly audio: 'device';
  readonly transcribedText: 'device' | 'cloud';
};

type GalleryDemoMetadata = {
  readonly id: string;
  readonly sourcePath: string;
  readonly title: string;
  readonly description: string;
  readonly capabilities: readonly ('microphone' | 'localTranscription' | 'remoteModel')[];
  readonly dataHandling: GalleryDataHandling;
};

/**
 * Named metadata lets each lazy demo loader carry the right capabilities and data-handling
 * policy even when the gallery's display order changes. No browser/runtime imports live here.
 */
export const transcriptionDemoDetails = {
  id: 'transcription',
  sourcePath: 'examples/demos/transcription-react',
  title: 'Local transcription',
  description: 'Your browser turns microphone audio into text on this device.',
  capabilities: ['microphone', 'localTranscription'],
  dataHandling: { audio: 'device', transcribedText: 'device' },
} as const satisfies GalleryDemoMetadata;
export const bingoDemoDetails = {
  id: 'bingo',
  sourcePath: 'examples/demos/bingo-react',
  title: 'Conversation bingo',
  description: 'Say it in the conversation. See it on the card.',
  capabilities: ['microphone', 'localTranscription'],
  dataHandling: { audio: 'device', transcribedText: 'device' },
} as const satisfies GalleryDemoMetadata;
export const notesDemoDetails = {
  id: 'notes',
  sourcePath: 'examples/demos/notes-react',
  title: 'Structured notes',
  description: 'Talk through a plan. Notes take shape as you finish each thought.',
  capabilities: ['microphone', 'localTranscription', 'remoteModel'],
  dataHandling: { audio: 'device', transcribedText: 'cloud' },
} as const satisfies GalleryDemoMetadata;
export const colorClashDemoDetails = {
  id: 'color-clash',
  sourcePath: 'examples/demos/gallery/shared/color-clash',
  title: 'Color Clash',
  description: 'Say the ink color, not the word. Speech stays on your device.',
  capabilities: ['microphone', 'localTranscription'],
  dataHandling: { audio: 'device', transcribedText: 'device' },
} as const satisfies GalleryDemoMetadata;

/** Ordered directory for gallery hosts; the named loaders do not depend on these positions. */
export const galleryDemoDetails = [
  transcriptionDemoDetails,
  bingoDemoDetails,
  notesDemoDetails,
  colorClashDemoDetails,
] as const satisfies readonly GalleryDemoMetadata[];

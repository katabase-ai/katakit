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
  /** Directory name for a local copy; only demos with their own example directory have one. */
  readonly copyDirectory?: string;
};

/**
 * Named metadata lets each lazy demo loader carry the right capabilities and data-handling
 * policy even when the gallery's display order changes. No browser/runtime imports live here.
 */
export const transcriptionDemoDetails = {
  id: 'transcription',
  sourcePath: 'examples/demos/transcription-react',
  copyDirectory: 'local-transcription',
  title: 'Local transcription',
  description: 'Turn speech into text on your device. Choose Start, then speak naturally.',
  capabilities: ['microphone', 'localTranscription'],
  dataHandling: { audio: 'device', transcribedText: 'device' },
} as const satisfies GalleryDemoMetadata;
export const bingoDemoDetails = {
  id: 'bingo',
  sourcePath: 'examples/demos/bingo-react',
  copyDirectory: 'conversation-bingo',
  title: 'Conversation bingo',
  description: 'Choose a word list and Start. Matching phrases mark the card; five in a row wins.',
  capabilities: ['microphone', 'localTranscription'],
  dataHandling: { audio: 'device', transcribedText: 'device' },
} as const satisfies GalleryDemoMetadata;
export const notesDemoDetails = {
  id: 'notes',
  sourcePath: 'examples/demos/notes-react',
  copyDirectory: 'structured-notes',
  title: 'Structured notes',
  description:
    'Choose Start to transcribe a plan on your device. With a model available, notes form as you speak.',
  capabilities: ['microphone', 'localTranscription', 'remoteModel'],
  dataHandling: { audio: 'device', transcribedText: 'cloud' },
} as const satisfies GalleryDemoMetadata;
export const colorClashDemoDetails = {
  id: 'color-clash',
  sourcePath: 'examples/demos/gallery/shared/color-clash',
  title: 'Color Clash',
  description:
    'Choose Play, then say the ink color, not the word. Score as many matches as you can in 20 seconds.',
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

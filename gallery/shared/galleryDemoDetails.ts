/**
 * Requirements for the current microphone/text demos, not connection readiness or active capture.
 * Remote inference explicitly declares text processing; it never implies sending microphone audio.
 */
export type GalleryRequiredCapabilities = {
  readonly microphone: true;
  readonly localTranscription: { readonly audio: 'device' };
  readonly remoteModel?: { readonly transcribedText: 'cloud' };
};

/** Presentation derived from requirements, never independently declared by a demo. */
export type GalleryDataHandling = {
  readonly audio: 'device';
  readonly transcribedText: 'device' | 'cloud';
};

export const galleryDataHandling = (
  requirements: GalleryRequiredCapabilities
): GalleryDataHandling => ({
  audio: requirements.localTranscription.audio,
  transcribedText: requirements.remoteModel?.transcribedText ?? 'device',
});

/** Tests a declared requirement without downloading, connecting, or probing a provider. */
export const requiresGalleryCapability = (
  requirements: GalleryRequiredCapabilities,
  capability: keyof GalleryRequiredCapabilities
) => requirements[capability] !== undefined;

/** Navigation sections in display order; hosts still select which demos to publish. */
export const galleryDemoSections = ['Basics', 'Games', 'Meetings'] as const;
export type GalleryDemoSection = (typeof galleryDemoSections)[number];

export type GalleryDemoMetadata = {
  readonly id: string;
  readonly sourcePath: string;
  readonly title: string;
  readonly section: GalleryDemoSection;
  readonly description: string;
  readonly requiredCapabilities: GalleryRequiredCapabilities;
  readonly tags: readonly ('game' | 'transcription' | 'productivity')[];
  /** Directory name for a local copy; only demos with their own example directory have one. */
  readonly copyDirectory?: string;
  readonly load: () => Promise<{ default: import('react').ComponentType }>;
};

/**
 * Named entries pair metadata with loaders independent of display order.
 * Browser/runtime imports occur only inside loaders, never while reading metadata.
 */
export const transcriptionDemoDetails = {
  id: 'transcription',
  sourcePath: 'examples/demos/transcription',
  copyDirectory: 'local-transcription',
  title: 'Transcription',
  section: 'Basics',
  description: 'Your browser turns microphone audio into text on this device.',
  requiredCapabilities: { microphone: true, localTranscription: { audio: 'device' } },
  tags: ['transcription'],
  load: async () => ({
    default: (await import('./TranscriptionGalleryDemo')).TranscriptionGalleryDemo,
  }),
} as const satisfies GalleryDemoMetadata;
export const bingoDemoDetails = {
  id: 'bingo',
  sourcePath: 'examples/demos/bingo',
  copyDirectory: 'conversation-bingo',
  title: 'Bingo',
  section: 'Games',
  description: 'Say it in the conversation. See it on the card. Five in a row wins!',
  requiredCapabilities: { microphone: true, localTranscription: { audio: 'device' } },
  tags: ['game'],
  load: async () => ({ default: (await import('./BingoGalleryDemo')).BingoGalleryDemo }),
} as const satisfies GalleryDemoMetadata;
export const notesDemoDetails = {
  id: 'notes',
  sourcePath: 'examples/demos/notes',
  copyDirectory: 'structured-notes',
  title: 'Structured notes',
  section: 'Meetings',
  description: 'Talk through a plan. Notes take shape as you finish each thought.',
  requiredCapabilities: {
    microphone: true,
    localTranscription: { audio: 'device' },
    remoteModel: { transcribedText: 'cloud' },
  },
  tags: ['productivity'],
  load: async () => ({ default: (await import('./NotesGalleryDemo')).NotesGalleryDemo }),
} as const satisfies GalleryDemoMetadata;
export const colorClashDemoDetails = {
  id: 'color-clash',
  sourcePath: 'examples/demos/color-clash',
  copyDirectory: 'color-clash',
  title: 'Color clash',
  section: 'Games',
  description: 'Say the ink color, not the word. Speech stays on your device.',
  requiredCapabilities: { microphone: true, localTranscription: { audio: 'device' } },
  tags: ['game'],
  load: async () => ({ default: (await import('./ColorClashGalleryDemo')).ColorClashGalleryDemo }),
} as const satisfies GalleryDemoMetadata;
export const wordRushDemoDetails = {
  id: 'word-rush',
  sourcePath: 'examples/demos/word-rush',
  copyDirectory: 'word-rush',
  title: 'Word rush',
  section: 'Games',
  description: 'Race the clock and collect spoken answers on a shared sticky-note board.',
  requiredCapabilities: {
    microphone: true,
    localTranscription: { audio: 'device' },
    remoteModel: { transcribedText: 'cloud' },
  },
  tags: ['game'],
  load: async () => ({ default: (await import('./WordRushGalleryDemo')).WordRushGalleryDemo }),
} as const satisfies GalleryDemoMetadata;

export const listExtractionDemoDetails = {
  id: 'list-extraction',
  sourcePath: 'examples/demos/list-extraction',
  copyDirectory: 'list-extraction',
  title: 'List extraction',
  section: 'Meetings',
  description: 'Tell it what to keep. Speak freely and collect selective lists.',
  requiredCapabilities: {
    microphone: true,
    localTranscription: { audio: 'device' },
    remoteModel: { transcribedText: 'cloud' },
  },
  tags: ['productivity'],
  load: async () => ({
    default: (await import('./ListExtractionGalleryDemo')).ListExtractionGalleryDemo,
  }),
} as const satisfies GalleryDemoMetadata;

/** Ordered directory for gallery hosts; the named loaders do not depend on these positions. */
export const galleryDemoDetails = [
  transcriptionDemoDetails,
  bingoDemoDetails,
  colorClashDemoDetails,
  wordRushDemoDetails,
  notesDemoDetails,
  listExtractionDemoDetails,
] as const satisfies readonly GalleryDemoMetadata[];

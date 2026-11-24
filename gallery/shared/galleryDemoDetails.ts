/** Requirements describe data flow, not connection readiness or active capture. */
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

export const requiresGalleryCapability = (
  requirements: GalleryRequiredCapabilities,
  capability: keyof GalleryRequiredCapabilities
) => requirements[capability] !== undefined;

type GalleryDemoMetadata = {
  readonly id: string;
  readonly sourcePath: string;
  readonly title: string;
  readonly description: string;
  readonly requiredCapabilities: GalleryRequiredCapabilities;
  readonly tags: readonly ('game' | 'transcription' | 'productivity')[];
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
  description: 'Your browser turns microphone audio into text on this device.',
  requiredCapabilities: { microphone: true, localTranscription: { audio: 'device' } },
  tags: ['transcription'],
} as const satisfies GalleryDemoMetadata;
export const bingoDemoDetails = {
  id: 'bingo',
  sourcePath: 'examples/demos/bingo-react',
  copyDirectory: 'conversation-bingo',
  title: 'Conversation bingo',
  description: 'Say it in the conversation. See it on the card. Five in a row wins!',
  requiredCapabilities: { microphone: true, localTranscription: { audio: 'device' } },
  tags: ['game'],
} as const satisfies GalleryDemoMetadata;
export const notesDemoDetails = {
  id: 'notes',
  sourcePath: 'examples/demos/notes-react',
  copyDirectory: 'structured-notes',
  title: 'Structured notes',
  description: 'Talk through a plan. Notes take shape as you finish each thought.',
  requiredCapabilities: {
    microphone: true,
    localTranscription: { audio: 'device' },
    remoteModel: { transcribedText: 'cloud' },
  },
  tags: ['productivity'],
} as const satisfies GalleryDemoMetadata;
export const colorClashDemoDetails = {
  id: 'color-clash',
  sourcePath: 'gallery/shared/color-clash',
  title: 'Color Clash',
  description: 'Say the ink color, not the word. Speech stays on your device.',
  requiredCapabilities: { microphone: true, localTranscription: { audio: 'device' } },
  tags: ['game'],
} as const satisfies GalleryDemoMetadata;
export const brainstormDemoDetails = {
  id: 'brainstorm',
  sourcePath: 'examples/demos/brainstorm-react',
  copyDirectory: 'brainstorming-game',
  title: 'Brainstorming game',
  description: 'Race the clock and collect spoken answers on a shared sticky-note board.',
  requiredCapabilities: {
    microphone: true,
    localTranscription: { audio: 'device' },
    remoteModel: { transcribedText: 'cloud' },
  },
  tags: ['game'],
} as const satisfies GalleryDemoMetadata;

export const listExtractionDemoDetails = {
  id: 'list-extraction',
  sourcePath: 'examples/demos/list-extraction-react',
  copyDirectory: 'list-extraction',
  title: 'List extraction',
  description: 'Tell it what to keep. Speak freely and collect selective lists.',
  requiredCapabilities: {
    microphone: true,
    localTranscription: { audio: 'device' },
    remoteModel: { transcribedText: 'cloud' },
  },
  tags: ['productivity'],
} as const satisfies GalleryDemoMetadata;

/** Ordered directory for gallery hosts; the named loaders do not depend on these positions. */
export const galleryDemoDetails = [
  transcriptionDemoDetails,
  bingoDemoDetails,
  notesDemoDetails,
  listExtractionDemoDetails,
  colorClashDemoDetails,
  brainstormDemoDetails,
] as const satisfies readonly GalleryDemoMetadata[];

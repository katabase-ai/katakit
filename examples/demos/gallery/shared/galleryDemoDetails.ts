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
 * React demos eligible for a gallery host. Metadata stays free of browser/runtime imports
 * so hosts can render a directory without instantiating a demo or loading recognizer code.
 */
export const galleryDemoDetails = [
  {
    id: 'transcription',
    sourcePath: 'examples/demos/transcription-react',
    title: 'Local transcription',
    description:
      'Set up local speech recognition, test your microphone, and learn the shared controls.',
    capabilities: ['microphone', 'localTranscription'],
    dataHandling: { audio: 'device', transcribedText: 'device' },
  },
  {
    id: 'bingo',
    sourcePath: 'examples/demos/bingo-react',
    title: 'Conversation bingo',
    description: 'Play a live bingo board using on-device microphone transcription.',
    capabilities: ['microphone', 'localTranscription'],
    dataHandling: { audio: 'device', transcribedText: 'device' },
  },
  {
    id: 'notes',
    sourcePath: 'examples/demos/notes-react',
    title: 'Structured notes',
    description:
      'Turn your speech into notes and correct misheard names. Audio stays local; notes use a host-supplied model connection.',
    capabilities: ['microphone', 'localTranscription', 'remoteModel'],
    dataHandling: { audio: 'device', transcribedText: 'cloud' },
  },
  {
    id: 'color-clash',
    sourcePath: 'examples/demos/gallery/shared/color-clash',
    title: 'Color Clash',
    description: 'Say the ink color before time runs out using on-device speech recognition.',
    capabilities: ['microphone', 'localTranscription'],
    dataHandling: { audio: 'device', transcribedText: 'device' },
  },
] as const satisfies readonly GalleryDemoMetadata[];

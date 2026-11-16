/**
 * React demos eligible for a gallery host. Metadata stays free of browser/runtime imports
 * so hosts can render a directory without instantiating a demo or loading recognizer code.
 */
export const galleryDemoDetails = [
  {
    id: 'transcription',
    sourcePath: 'demos/transcription-react',
    title: 'Local transcription',
    description:
      'Set up local speech recognition, test your microphone, and learn the shared controls.',
    capabilities: ['microphone', 'localTranscription'],
  },
  {
    id: 'bingo',
    sourcePath: 'demos/bingo-react',
    title: 'Conversation bingo',
    description: 'Play a live bingo board using on-device microphone transcription.',
    capabilities: ['microphone', 'localTranscription'],
  },
  {
    id: 'notes',
    sourcePath: 'demos/notes-react',
    title: 'Live discussion notes',
    description:
      'Turn your speech into notes and correct misheard names. Audio stays local; notes use a host-supplied model connection.',
    capabilities: ['microphone', 'localTranscription', 'remoteModel'],
  },
] as const;

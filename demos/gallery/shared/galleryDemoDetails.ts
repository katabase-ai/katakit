/**
 * React demos eligible for a gallery host. Metadata stays free of browser/runtime imports
 * so hosts can render a directory without instantiating a demo or loading recognizer code.
 */
export const galleryDemoDetails = [
  {
    id: 'transcription',
    title: 'Local transcription',
    description:
      'Set up local speech recognition, test your microphone, and learn the shared controls.',
    capabilities: ['microphone', 'localTranscription'],
  },
  {
    id: 'bingo',
    title: 'Conversation bingo',
    description: 'Play a live bingo board using on-device microphone transcription.',
    capabilities: ['microphone', 'localTranscription'],
  },
] as const;

/**
 * React demos eligible for a gallery host. Metadata stays free of browser/runtime imports
 * so hosts can render a directory without instantiating a demo or loading recognizer code.
 */
export const galleryDemoDetails = [
  {
    id: 'transcription',
    title: 'Conversation transcription',
    description: 'Record speech and see conversation turns transcribed locally in your browser.',
    capabilities: ['microphone', 'localTranscription'],
  },
  {
    id: 'bingo',
    title: 'Conversation bingo',
    description: 'Play a live bingo board using on-device microphone transcription.',
    capabilities: ['microphone', 'localTranscription'],
  },
] as const;

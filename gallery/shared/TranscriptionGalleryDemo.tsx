import { TranscriptView } from '../../examples/demos/transcription-react/src/transcription/TranscriptView';
import { createTranscriptionDemo } from '../../examples/demos/transcription-react/src/transcription/createTranscriptionDemo';
import { createGalleryDemo, type GalleryDemoViewProps } from './createGalleryDemo';
import { TranscriptionIntroduction } from './TranscriptionIntroduction';

const View = (props: GalleryDemoViewProps<ReturnType<typeof createTranscriptionDemo>>) => (
  <TranscriptView {...props} introduction={<TranscriptionIntroduction />} />
);

export const TranscriptionGalleryDemo = createGalleryDemo({
  createRuntime: createTranscriptionDemo,
  View,
});

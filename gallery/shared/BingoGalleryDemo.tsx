import { useEffect, type ContextType } from 'react';
import mitt from 'mitt';
import { MicrophoneTranscriberContext } from '@katakit/transcription/react';
import { Bingo } from '../../examples/demos/bingo-react/src/bingo/bingo';
import { createGalleryDemo, type GalleryDemoViewProps } from './createGalleryDemo';
import type { GalleryInputSink } from './createGallerySpeech';
import { useGallerySpeech } from './GallerySpeechProvider';

type Microphone = NonNullable<ContextType<typeof MicrophoneTranscriberContext>>;

// One emitter per gallery visit. Capture stays with the gallery across word list changes.
const createBingoInput = () => {
  const emitter: Microphone['emitter'] = mitt();
  return {
    emitter,
    ingestSegment: segment => emitter.emit('utterance', segment),
    updateProvisional: text => emitter.emit('provisionalUtterance', text),
    flush: () => emitter.emit('flush'),
    close: () => emitter.emit('close'),
  } satisfies GalleryInputSink & Pick<Microphone, 'emitter'>;
};

const BingoView = ({
  runtime,
  ...props
}: GalleryDemoViewProps<ReturnType<typeof createBingoInput>>) => {
  const session = useGallerySpeech();
  const level = session?.snapshot.level ?? 0;
  useEffect(() => runtime.emitter.emit('level', level), [runtime, level]);
  if (!session) return null;
  const { owner, snapshot } = session;
  const listening = snapshot.input.phase === 'running';
  return (
    <MicrophoneTranscriberContext
      value={{
        emitter: runtime.emitter,
        state: snapshot.input,
        listening,
        busy: snapshot.transitioning || snapshot.starting || snapshot.blocked,
        toggle: async () => {
          await (listening ? owner.stop() : owner.start());
        },
      }}
    >
      <Bingo {...props} />
    </MicrophoneTranscriberContext>
  );
};

export const BingoGalleryDemo = createGalleryDemo({
  createRuntime: createBingoInput,
  View: BingoView,
});

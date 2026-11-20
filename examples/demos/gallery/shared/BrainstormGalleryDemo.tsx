import { useCallback } from 'react';
import { BrainstormDemo } from '../../brainstorm-react/src/BrainstormDemo';
import { createBrainstormDemo } from '../../brainstorm-react/src/createBrainstormDemo';
import { BrainstormRequestError } from '../../brainstorm-react/src/brainstormModel';
import { GalleryDemo } from './GalleryDemo';
import { GalleryModelError, useGalleryModel } from './galleryModel';
import { useGallerySpeech } from './GallerySpeechProvider';
import { GalleryDemoCapture, useGalleryDemoHeader } from './GalleryDemoHeader';
import { GalleryMicrophoneIndicator } from './GalleryMicrophoneIndicator';

const toGameError = (error: unknown) =>
  error instanceof GalleryModelError
    ? new BrainstormRequestError(error.message, error.policy)
    : error;

export const BrainstormGalleryDemo = () => {
  const session = useGallerySpeech();
  const model = useGalleryModel();
  const hasHeader = useGalleryDemoHeader();
  const connectGallery = model.connect;
  const connect = useCallback(
    async (input: { signal: AbortSignal }) => {
      try {
        const connection = await connectGallery!(input);
        return {
          ...connection,
          requestCompletion: async (request: { body: string; signal: AbortSignal }) => {
            try {
              return await connection.requestCompletion(request);
            } catch (error) {
              throw toGameError(error);
            }
          },
        };
      } catch (error) {
        throw toGameError(error);
      }
    },
    [connectGallery]
  );
  const owner = session?.owner;
  const stopListening = useCallback(async () => {
    await owner?.stop();
  }, [owner]);
  const startListening = useCallback(
    async (signal: AbortSignal) => {
      if (!owner) return false;
      const cancel = async () => {
        try {
          await owner.cancel();
        } catch {
          /* The shared owner presents cleanup failures. */
        }
      };
      signal.addEventListener('abort', cancel, { once: true });
      try {
        signal.throwIfAborted();
        await owner.start();
        return !signal.aborted && owner.getSnapshot().input.phase === 'running';
      } finally {
        signal.removeEventListener('abort', cancel);
      }
    },
    [owner]
  );
  const isListening = useCallback(() => owner?.getSnapshot().input.phase === 'running', [owner]);
  const input = session?.snapshot.input;
  const microphoneError = session?.snapshot.error ?? input?.error?.message;
  return (
    <GalleryDemo
      create={createBrainstormDemo}
      render={runtime => (
        <BrainstormDemo
          showIntroduction={!hasHeader}
          runtime={runtime}
          listening={session?.snapshot.input.phase === 'running'}
          startListening={startListening}
          isListening={isListening}
          stopListening={stopListening}
          captureDisabled={
            !session ||
            session.snapshot.blocked ||
            session.snapshot.transitioning ||
            !session.snapshot.attached
          }
          setupMessage={
            input?.phase === 'loading'
              ? `Downloading speech model…${input.progress === undefined ? '' : ` ${Math.round(input.progress * 100)}%`}`
              : 'Allow microphone access in your browser.'
          }
          connect={connectGallery && connect}
          controls={
            microphoneError && (
              <p role="alert">
                {microphoneError}
                {session?.snapshot.blocked && ' Reload this page to try again.'}
              </p>
            )
          }
          connectionHelp={
            !model.settingsNotice && (
              <p>Full judging is unavailable here. Sample practice still works.</p>
            )
          }
          renderModelControls={model.renderControls}
          roundControlClassName="gallery-capture-toggle"
          renderRoundControls={controls => (
            <GalleryDemoCapture>
              <div className="gallery-capture-controls gallery-capture-action">
                <GalleryMicrophoneIndicator
                  recording={input?.phase === 'running'}
                  level={session?.snapshot.level ?? 0}
                />
                {controls}
              </div>
            </GalleryDemoCapture>
          )}
        />
      )}
    />
  );
};

import { useCallback } from 'react';
import { WordRushDemo } from '../../examples/demos/word-rush/src/WordRushDemo';
import { createWordRushDemo } from '../../examples/demos/word-rush/src/createWordRushDemo';
import { WordRushRequestError } from '../../examples/demos/word-rush/src/wordRushModel';
import { GalleryDemo } from './GalleryDemo';
import { GalleryModelError, useGalleryModel } from './galleryModel';
import { useGallerySpeech } from './GallerySpeechProvider';
import { GalleryDemoCapture, useGalleryDemoHeader } from './GalleryDemoHeader';
import { GalleryMicrophoneIndicator } from './GalleryMicrophoneIndicator';
import { GalleryCaptureControls } from './GalleryCaptureControls';

const toGameError = (error: unknown) =>
  error instanceof GalleryModelError
    ? new WordRushRequestError(error.message, error.policy)
    : error;

export const WordRushGalleryDemo = () => {
  const session = useGallerySpeech();
  const model = useGalleryModel();
  const hasHeader = useGalleryDemoHeader();
  const connectGallery = model.connect;
  const connect = useCallback(
    async (input: { signal: AbortSignal }) => {
      try {
        const connection = await connectGallery!(input);
        const decisions = connection.decisions;
        if (!decisions)
          throw new WordRushRequestError(
            'This connection does not provide a Jev judge. Use managed inference or an OpenRouter connection.'
          );
        return {
          ...connection,
          decisions: {
            ...decisions,
            requestDecision: async (request: { body: string; signal: AbortSignal }) => {
              try {
                return await decisions.requestDecision(request);
              } catch (error) {
                throw toGameError(error);
              }
            },
          },
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
      create={createWordRushDemo}
      render={runtime => (
        <WordRushDemo
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
          connectionHelp={!model.settingsNotice && <p>Configure a judging connection to play.</p>}
          renderModelControls={model.renderControls}
          roundControlClassName="gallery-capture-toggle"
          renderRoundButton={action => <GalleryCaptureControls action={action} />}
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

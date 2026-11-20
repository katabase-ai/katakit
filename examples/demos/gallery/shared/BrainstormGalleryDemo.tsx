import { useCallback } from 'react';
import { BrainstormDemo } from '../../brainstorm-react/src/BrainstormDemo';
import { createBrainstormDemo } from '../../brainstorm-react/src/createBrainstormDemo';
import { BrainstormRequestError } from '../../brainstorm-react/src/brainstormModel';
import { GalleryDemo } from './GalleryDemo';
import { GalleryModelError, useGalleryModel } from './galleryModel';
import { useGallerySpeech } from './GallerySpeechProvider';
import { GalleryCaptureControls } from './GalleryCaptureControls';
import { useGalleryDemoHeader } from './GalleryDemoHeader';

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
  return (
    <GalleryDemo
      create={createBrainstormDemo}
      render={runtime => (
        <BrainstormDemo
          showIntroduction={!hasHeader}
          runtime={runtime}
          listening={session?.snapshot.input.phase === 'running'}
          stopListening={stopListening}
          connect={connectGallery && connect}
          controls={<GalleryCaptureControls />}
          connectionHelp={
            model.configure ? (
              <p>
                Use sample practice, or{' '}
                <button
                  type="button"
                  className="site-button"
                  onClick={() => model.configure?.('inference')}
                >
                  Configure inference
                </button>{' '}
                to judge other answers.
              </p>
            ) : (
              <p>Full judging is unavailable here. Sample practice still works.</p>
            )
          }
          renderModelControls={model.renderControls}
        />
      )}
    />
  );
};

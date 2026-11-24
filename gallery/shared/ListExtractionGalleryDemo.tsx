import { useCallback } from 'react';
import { createListExtractionDemo } from '../../examples/demos/list-extraction-react/src/createListExtractionDemo';
import { ListExtractionDemo } from '../../examples/demos/list-extraction-react/src/ListExtractionDemo';
import { ExtractionError } from '../../examples/demos/list-extraction-react/src/extractionModel';
import { GalleryCaptureControls } from './GalleryCaptureControls';
import { GalleryDemo } from './GalleryDemo';
import { useGalleryDemoHeader } from './GalleryDemoHeader';
import { GalleryModelError, useGalleryModel } from './galleryModel';
import { useGallerySpeech } from './GallerySpeechProvider';

const toExtractionError = (error: unknown) =>
  error instanceof GalleryModelError ? new ExtractionError(error.message, error.policy) : error;

/** Host-owned speech and inference; the copyable example owns its rules, items and sources. */
export const ListExtractionGalleryDemo = () => {
  const model = useGalleryModel();
  const speech = useGallerySpeech();
  const hasHeader = useGalleryDemoHeader();
  const connectGallery = model.connect;
  const connect = useCallback(
    async ({ signal }: { signal: AbortSignal }) => {
      try {
        const connection = await connectGallery!({ signal });
        return {
          ...connection,
          requestCompletion: async (input: { body: string; signal: AbortSignal }) => {
            try {
              return await connection.requestCompletion(input);
            } catch (error) {
              throw toExtractionError(error);
            }
          },
        };
      } catch (error) {
        throw toExtractionError(error);
      }
    },
    [connectGallery]
  );
  const phase = speech?.snapshot.input.phase;
  return (
    <GalleryDemo
      create={createListExtractionDemo}
      render={runtime => (
        <ListExtractionDemo
          runtime={runtime}
          connect={connectGallery && connect}
          showIntroduction={!hasHeader}
          listening={phase === 'running'}
          captureBusy={
            !!speech?.snapshot.transitioning ||
            phase === 'loading' ||
            phase === 'starting' ||
            phase === 'stopping'
          }
          controls={<GalleryCaptureControls />}
          renderModelControls={model.renderControls}
          connectionHelp={
            model.settingsNotice ? (
              false
            ) : (
              <p className="extraction-hint">
                {model.configure ? (
                  <>
                    No inference is configured. You can still dictate locally or try the sample.{' '}
                    <button
                      type="button"
                      className="site-button"
                      onClick={() => model.configure?.('inference')}
                    >
                      Configure inference
                    </button>
                  </>
                ) : (
                  'Free inference is not available here. You can still dictate locally or try the sample.'
                )}
              </p>
            )
          }
        />
      )}
    />
  );
};

import { useCallback } from 'react';
import { createNotesDemo } from '../../notes-react/src/createNotesDemo';
import { NotesDemo } from '../../notes-react/src/NotesDemo';
import { NotesRequestError } from '../../notes-react/src/notesModel';
import { GalleryCaptureControls } from './GalleryCaptureControls';
import { GalleryDemo } from './GalleryDemo';
import { GalleryModelError, useGalleryModel } from './galleryModel';
import { useGalleryDemoHeader } from './GalleryDemoHeader';
import { useGallerySpeech } from './GallerySpeechProvider';

// The copyable example recognizes only its own error class, so host failures are rethrown as it.
const toNotesError = (error: unknown) =>
  error instanceof GalleryModelError ? new NotesRequestError(error.message, error.policy) : error;

/** The gallery's host supplies model admission; shared speech attaches only to this visit's runtime. */
export const NotesGalleryDemo = () => {
  const model = useGalleryModel();
  const listening = useGallerySpeech()?.snapshot.input.phase === 'running';
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
              throw toNotesError(error);
            }
          },
        };
      } catch (error) {
        throw toNotesError(error);
      }
    },
    [connectGallery]
  );
  return (
    <GalleryDemo
      create={createNotesDemo}
      render={runtime => (
        <NotesDemo
          showIntroduction={!hasHeader}
          runtime={runtime}
          listening={listening}
          // The Settings button explains a missing connection, where the remedy is one click away.
          connectionHelp={model.settingsNotice ? false : undefined}
          controls={<GalleryCaptureControls />}
          connect={connectGallery && connect}
          renderModelControls={model.renderControls}
        />
      )}
    />
  );
};

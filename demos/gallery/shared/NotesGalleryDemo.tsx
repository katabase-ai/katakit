import type { ComponentProps } from 'react';
import { createNotesDemo } from '../../notes-react/src/createNotesDemo';
import { NotesDemo } from '../../notes-react/src/NotesDemo';
import { GalleryDemo } from './GalleryDemo';
import { useGallerySpeech } from './GallerySpeechProvider';

/** Hosts supply model admission; shared speech attaches only to this visit's runtime. */
export const NotesGalleryDemo = ({
  connect,
  renderModelControls,
}: Pick<ComponentProps<typeof NotesDemo>, 'connect' | 'renderModelControls'>) => {
  const session = useGallerySpeech();
  return (
    <GalleryDemo
      create={createNotesDemo}
      render={runtime => (
        <NotesDemo
          runtime={runtime}
          listening={session?.snapshot.input.phase === 'running'}
          connect={connect}
          renderModelControls={renderModelControls}
        />
      )}
    />
  );
};

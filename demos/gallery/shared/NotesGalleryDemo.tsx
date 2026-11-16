import type { ComponentProps } from 'react';
import { createNotesDemo } from '../../notes-react/src/createNotesDemo';
import { NotesDemo } from '../../notes-react/src/NotesDemo';
import { GalleryDemo } from './GalleryDemo';

/** Hosts supply model admission; shared speech attaches only to this visit's runtime. */
export const NotesGalleryDemo = ({
  connect,
  renderModelControls,
}: Pick<ComponentProps<typeof NotesDemo>, 'connect' | 'renderModelControls'>) => (
  <GalleryDemo
    create={createNotesDemo}
    render={runtime => (
      <NotesDemo runtime={runtime} connect={connect} renderModelControls={renderModelControls} />
    )}
  />
);

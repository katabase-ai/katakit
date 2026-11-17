import { useEffect } from 'react';
import { ColorClash } from '../../color-clash-react/src/ColorClash';
import { createColorClash } from '../../color-clash-react/src/createColorClash';
import { GalleryDemo } from './GalleryDemo';
import { useGallerySpeech } from './GallerySpeechProvider';

/** The game uses a shared input lease; its Play action starts both capture and the timed round. */
export const ColorClashGalleryDemo = () => {
  const session = useGallerySpeech();
  const owner = session?.owner;
  useEffect(() => () => void owner?.cancel(), [owner]);
  if (!session) return <p role="status">Preparing Color Clash…</p>;
  const { snapshot } = session;
  return (
    <GalleryDemo
      create={createColorClash}
      render={runtime => (
        <ColorClash
          runtime={runtime}
          input={snapshot.input}
          error={
            snapshot.blocked ? `${snapshot.error} Reload this page to try again.` : snapshot.error
          }
          disabled={snapshot.blocked || snapshot.transitioning || !snapshot.attached}
          onPlay={async () => {
            await session.owner.start();
            return session.owner.getSnapshot().input.phase === 'running';
          }}
          onCancel={() => void session.owner.cancel()}
          onStop={session.owner.stop}
        />
      )}
    />
  );
};

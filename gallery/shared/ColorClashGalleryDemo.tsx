import { ColorClash } from './color-clash/ColorClash';
import { createColorClash } from './color-clash/createColorClash';
import { GalleryDemo } from './GalleryDemo';
import { useGallerySpeech } from './GallerySpeechProvider';
import { useGalleryDemoHeader } from './GalleryDemoHeader';
import { useGalleryEvents } from './galleryEvents';

/** The gallery owns capture; the existing game owns its round and stops capture when it finishes. */
export const ColorClashGalleryDemo = () => {
  const session = useGallerySpeech();
  const hasHeader = useGalleryDemoHeader();
  const { report } = useGalleryEvents();
  if (!session) return <p role="status">Preparing Color Clash…</p>;
  const { snapshot, owner } = session;
  // Preserve typed microphone errors so the game can show its permission-recovery instructions.
  const error = snapshot.blocked
    ? `${snapshot.error ?? 'Speech recognition is unavailable.'} Reload this page to try again.`
    : snapshot.error === snapshot.input.error?.message
      ? undefined
      : snapshot.error;
  return (
    <>
      {!hasHeader && (
        <>
          <h1>Color Clash</h1>
          <p className="gallery-intro">
            Say the ink color, not the word. Speech stays on your device.
          </p>
        </>
      )}
      <GalleryDemo
        create={createColorClash}
        render={runtime => (
          <ColorClash
            runtime={runtime}
            input={snapshot.input}
            error={error}
            disabled={snapshot.blocked || snapshot.transitioning || !snapshot.attached}
            onPlay={async () => {
              report({ type: 'demoControlUsed', control: 'play' });
              await owner.start();
              return owner.getSnapshot().input.phase === 'running';
            }}
            onCancel={() => {
              report({ type: 'demoControlUsed', control: 'cancel' });
              void owner.cancel();
            }}
            onStop={owner.stop}
          />
        )}
      />
    </>
  );
};

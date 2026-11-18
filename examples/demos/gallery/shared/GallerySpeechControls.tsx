import { useContext } from 'react';
import { useGallerySpeech } from './GallerySpeechProvider';
import { GalleryModelContext } from './galleryModel';

/** Public visitors can download speech and see managed inference status, never configure BYOK. */
export const GallerySpeechControls = () => {
  const session = useGallerySpeech();
  const { hostAvailable } = useContext(GalleryModelContext);
  const snapshot = session?.snapshot;
  const loading = snapshot?.input.phase === 'loading';
  const ready =
    snapshot && ['ready', 'running', 'starting', 'stopping'].includes(snapshot.input.phase);
  return (
    <section aria-label="Operation status">
      <div className="gallery-operation-row">
        <span>Transcription</span>
        {ready ? (
          <span role="status">Ready · local</span>
        ) : (
          <button
            type="button"
            disabled={!session || snapshot?.blocked || (!loading && snapshot?.transitioning)}
            onClick={() => void (loading ? session?.owner.cancel() : session?.owner.load())}
          >
            {loading ? 'Cancel download' : 'Download model'}
          </button>
        )}
      </div>
      <div className="gallery-operation-row">
        <span>Inference</span>
        <span>{hostAvailable ? 'Free demo' : 'Not connected'}</span>
      </div>
      {(snapshot?.error || snapshot?.input.error) && (
        <p role="alert">{snapshot.error ?? snapshot.input.error?.message}</p>
      )}
    </section>
  );
};

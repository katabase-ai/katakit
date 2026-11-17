import { useContext, type ReactNode } from 'react';
import type { TranscriptionModelId } from '@katakit/transcription/browser';
import { useGallerySpeech } from './GallerySpeechProvider';
import { GalleryModelContext } from './galleryModel';

/** Kept as a host adapter type; model selection now lives in developer Operation Setup. */
export type GalleryModelSelect = (props: {
  model: TranscriptionModelId;
  disabled: boolean;
  onChange: (model: TranscriptionModelId) => void;
}) => ReactNode;

/** Public visitors can download speech and see managed inference status, never configure BYOK. */
export const GallerySpeechControls = (_props: { renderModelSelect?: GalleryModelSelect }) => {
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

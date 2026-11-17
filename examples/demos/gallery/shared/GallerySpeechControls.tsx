import { useCallback, useContext, type ReactNode, type RefCallback } from 'react';
import { transcriptionModels, type TranscriptionModelId } from '@katakit/transcription/browser';
import { GalleryModelContext } from './galleryModel';
import { useGallerySpeech } from './GallerySpeechProvider';

/** The private host supplies its existing Select without a private demo dependency. */
export type GalleryModelSelect = (props: {
  model: TranscriptionModelId;
  disabled: boolean;
  onChange: (model: TranscriptionModelId) => void;
}) => ReactNode;

/** Stay mounted outside the keyed demo view, including during lazy input handoffs. */
export const GallerySpeechControls = ({
  renderModelSelect,
}: {
  renderModelSelect?: GalleryModelSelect;
}) => {
  const { setControls } = useContext(GalleryModelContext);
  // Fit the host header and reserve mobile space for variable-height hints and errors.
  const measureInput: RefCallback<HTMLElement> = useCallback(node => {
    const gallery = node?.closest('.katakit-gallery');
    if (!node || !(gallery instanceof HTMLElement)) return;
    const measure = () => {
      gallery.style.setProperty(
        '--gallery-input-height',
        `${node.getBoundingClientRect().height}px`
      );
      gallery.style.setProperty(
        '--gallery-sidebar-height',
        `${window.innerHeight - Math.max(0, gallery.getBoundingClientRect().top)}px`
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      gallery.style.removeProperty('--gallery-input-height');
      gallery.style.removeProperty('--gallery-sidebar-height');
    };
  }, []);
  const session = useGallerySpeech();
  if (!session)
    return (
      <section
        ref={measureInput}
        className="gallery-speech-controls"
        aria-label="Microphone and model"
      >
        <p role="status">Preparing microphone controls…</p>
      </section>
    );
  const { owner, snapshot } = session;
  const recording = snapshot.input.phase === 'running';
  const preparing = ['loading', 'starting'].includes(snapshot.input.phase);
  const ready = snapshot.input.phase === 'ready';
  const disabled = snapshot.blocked || snapshot.transitioning;
  const select = (model: TranscriptionModelId) => {
    void owner.select(model);
  };
  return (
    <section
      id="gallery-input"
      ref={measureInput}
      className="gallery-speech-controls"
      aria-label="Microphone and model"
      tabIndex={-1}
    >
      {renderModelSelect ? (
        renderModelSelect({
          model: snapshot.model,
          disabled: disabled || recording,
          onChange: select,
        })
      ) : (
        <div className="site-field">
          <label htmlFor="gallery-model">Transcription model</label>
          <select
            id="gallery-model"
            className="site-select"
            value={snapshot.model}
            disabled={disabled || recording}
            onChange={event => select(event.target.value as TranscriptionModelId)}
          >
            {transcriptionModels.map(model => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="gallery-speech-actions">
        <button
          type="button"
          disabled={
            snapshot.blocked || (!preparing && (snapshot.transitioning || !snapshot.attached))
          }
          aria-describedby="gallery-input-status"
          className={`site-button site-button--slate gallery-microphone${recording ? ' is-listening' : ''}`}
          onClick={() =>
            void (preparing ? owner.cancel() : recording ? owner.stop() : owner.start())
          }
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            {recording ? (
              <rect x="6" y="6" width="12" height="12" rx="2" />
            ) : (
              <>
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
              </>
            )}
          </svg>
          {preparing ? 'Cancel' : recording ? 'Stop listening' : 'Start listening'}
        </button>
        {!preparing && !recording && !ready && (
          <button
            type="button"
            className="site-button site-button--ghost gallery-load-model"
            disabled={disabled || !snapshot.attached}
            onClick={() => void owner.load()}
          >
            Load model
          </button>
        )}
      </div>
      <p id="gallery-input-status" role="status" aria-live="polite">
        {preparing
          ? snapshot.input.phase === 'loading'
            ? `Loading model${snapshot.input.progress === undefined ? '…' : `: ${Math.round(snapshot.input.progress * 100)}%`} · mic off`
            : 'Waiting for microphone permission…'
          : recording
            ? 'Listening locally'
            : snapshot.transitioning
              ? 'Finishing input…'
              : !snapshot.attached
                ? ready
                  ? 'Model ready · open a demo to listen.'
                  : 'Open a demo to use the microphone.'
                : ready
                  ? 'Model ready · microphone off'
                  : 'Model not loaded · microphone off'}
      </p>
      {recording && (
        <div className="site-audio-level" role="img" aria-label="Microphone: listening">
          <span className="site-audio-level__label">Microphone</span>
          <span className="site-audio-level__track" aria-hidden="true">
            <span
              className="site-audio-level__fill"
              style={{ width: `${Math.round(Math.max(0, Math.min(1, snapshot.level)) * 100)}%` }}
            />
          </span>
          <span className="site-audio-level__state">Listening</span>
        </div>
      )}
      {(snapshot.error || snapshot.input.error) && (
        <p role="alert">
          {snapshot.error ?? snapshot.input.error?.message}{' '}
          {snapshot.blocked
            ? 'Reload this page before trying again.'
            : 'Try loading or starting again.'}
        </p>
      )}
      {snapshot.model === 'whisper-tiny' && (
        <p className="gallery-model-hint">
          Whisper returns text in ten-second batches and when you stop.
        </p>
      )}
      <p className="gallery-processing-notice">Processed on your device.</p>
      {/* A remoteModel demo portals its connection controls here; empty for the other demos. */}
      <div className="gallery-model-controls" ref={setControls} />
    </section>
  );
};

import { useId, type ReactNode } from 'react';
import { useGallerySpeech } from './GallerySpeechProvider';
import { GalleryMicrophoneIndicator } from './GalleryMicrophoneIndicator';
import {
  GalleryMicrophoneRecovery,
  getGalleryMicrophoneFailure,
} from './GalleryMicrophoneRecovery';

/** Capture actions belong to the active demo, never the shared setup footer. */
export const GalleryCaptureControls = ({
  label = 'Start listening',
  errorHelp,
  children,
  presentation = 'default',
}: {
  label?: string;
  /** Replaces default errors; Welcome presents this guidance beside its action. */
  errorHelp?: ReactNode;
  children?: ReactNode;
  /** Welcome uses a passive mic glyph and keeps capture status accessible without a meter. */
  presentation?: 'default' | 'welcome';
}) => {
  const session = useGallerySpeech();
  const statusId = useId();
  if (!session) return <p role="status">Preparing microphone…</p>;
  const { owner, snapshot } = session;
  const recording = snapshot.input.phase === 'running';
  const preparing = ['loading', 'starting'].includes(snapshot.input.phase);
  const stopping = snapshot.input.phase === 'stopping';
  const failed = !!(snapshot.blocked || snapshot.error || snapshot.input.error);
  const failure = getGalleryMicrophoneFailure(snapshot);
  const welcome = presentation === 'welcome';
  const statusLine = (
    <p id={statusId} role="status" className={welcome ? 'gallery-visually-hidden' : undefined}>
      {welcome
        ? recording
          ? 'Microphone listening'
          : 'Microphone off'
        : snapshot.input.phase === 'loading'
          ? `Downloading model${snapshot.input.progress === undefined ? '…' : `: ${Math.round(snapshot.input.progress * 100)}%`} · microphone off`
          : snapshot.input.phase === 'starting'
            ? 'Waiting for microphone permission…'
            : recording
              ? 'Listening locally'
              : snapshot.transitioning
                ? 'Finishing input…'
                : 'Microphone off'}
    </p>
  );
  const button = (
    <button
      type="button"
      className="site-button site-button--slate"
      disabled={
        !snapshot.blocked &&
        (stopping || (!preparing && (snapshot.transitioning || !snapshot.attached)))
      }
      aria-describedby={statusId}
      onClick={() => {
        if (snapshot.blocked) window.location.reload();
        else void (preparing ? owner.cancel() : recording ? owner.stop() : owner.start());
      }}
    >
      {snapshot.blocked
        ? 'Reload page'
        : preparing
          ? snapshot.input.phase === 'loading'
            ? 'Cancel download'
            : 'Cancel setup'
          : recording
            ? 'Stop listening'
            : stopping
              ? 'Stopping…'
              : failed
                ? failure.permissionDenied
                  ? 'Try microphone again'
                  : 'Try again'
                : label}
    </button>
  );
  return (
    <div className={`gallery-capture-controls${welcome ? ' gallery-welcome-capture-actions' : ''}`}>
      {!welcome && children}
      {!welcome && errorHelp}
      {welcome && <GalleryMicrophoneIndicator recording={recording} level={snapshot.level} />}
      {button}
      {welcome && (
        <div className="gallery-welcome-capture-feedback">
          {children}
          {errorHelp}
        </div>
      )}
      {statusLine}
      {recording && !welcome && (
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
      {!errorHelp && failed && (
        <GalleryMicrophoneRecovery failure={failure} blocked={snapshot.blocked} />
      )}
    </div>
  );
};

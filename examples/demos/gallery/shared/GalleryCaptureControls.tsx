import { useId, type ReactNode } from 'react';
import { useGallerySpeech } from './GallerySpeechProvider';
import { GalleryMicrophoneIndicator } from './GalleryMicrophoneIndicator';

/** Capture actions belong to the active demo, never the shared setup footer. */
export const GalleryCaptureControls = ({
  label = 'Start listening',
  errorHelp,
  children,
  presentation = 'default',
}: {
  label?: string;
  /** Replaces default errors; Welcome presents this guidance beneath its action. */
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
      disabled={snapshot.blocked || (!preparing && (snapshot.transitioning || !snapshot.attached))}
      aria-describedby={statusId}
      onClick={() => void (preparing ? owner.cancel() : recording ? owner.stop() : owner.start())}
    >
      {preparing
        ? welcome && snapshot.input.phase === 'loading'
          ? 'Cancel download'
          : 'Cancel'
        : recording
          ? 'Stop listening'
          : label}
    </button>
  );
  return (
    <div className={`gallery-capture-controls${welcome ? ' gallery-welcome-capture' : ''}`}>
      {!welcome && children}
      {!welcome && errorHelp}
      {welcome ? (
        <div className="gallery-welcome-capture-actions">
          <GalleryMicrophoneIndicator recording={recording} level={snapshot.level} />
          {button}
        </div>
      ) : (
        button
      )}
      {statusLine}
      {welcome && children}
      {welcome && errorHelp}
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
      {!errorHelp && (snapshot.error || snapshot.input.error) && (
        <p role="alert">
          {snapshot.error ?? snapshot.input.error?.message}{' '}
          {snapshot.blocked
            ? 'Reload this page before trying again.'
            : 'Try downloading or starting again.'}
        </p>
      )}
    </div>
  );
};

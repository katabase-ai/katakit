import { useEffect, useId, useState, type ReactNode } from 'react';
import { GalleryDemoCapture } from './GalleryDemoHeader';
import { useGallerySpeech } from './GallerySpeechProvider';
import { GalleryMicrophoneIndicator } from './GalleryMicrophoneIndicator';
import {
  GalleryMicrophoneRecovery,
  getGalleryMicrophoneFailure,
} from './GalleryMicrophoneRecovery';

/** Capture stays in the active demo; the header hosts its button when present. */
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
  presentation?: 'default' | 'welcome';
}) => {
  const session = useGallerySpeech();
  const statusId = useId();
  // Rise immediately and fall gradually rather than flickering with every audio sample.
  const [shownLevel, setShownLevel] = useState(0);
  const snapshotForLevel = session?.snapshot;
  useEffect(() => {
    const level =
      snapshotForLevel?.input.phase === 'running' && Number.isFinite(snapshotForLevel.level)
        ? Math.max(0, Math.min(1, snapshotForLevel.level))
        : 0;
    setShownLevel(shown => (level >= shown ? level : shown * 0.7 + level * 0.3));
  }, [snapshotForLevel]);
  if (!session) return <p role="status">Preparing microphone…</p>;
  const { owner, snapshot } = session;
  const recording = snapshot.input.phase === 'running';
  const preparing = snapshot.input.phase === 'loading' || snapshot.input.phase === 'starting';
  const stopping = snapshot.input.phase === 'stopping';
  const failed = !!(snapshot.blocked || snapshot.error || snapshot.input.error);
  const failure = getGalleryMicrophoneFailure(snapshot);
  const disabled =
    !snapshot.blocked &&
    (stopping || (!preparing && (snapshot.transitioning || !snapshot.attached)));
  const toggle = () => {
    if (snapshot.blocked) window.location.reload();
    else void (preparing ? owner.cancel() : recording ? owner.stop() : owner.start());
  };

  if (presentation === 'welcome')
    return (
      <div className="gallery-capture-controls gallery-welcome-capture-actions">
        <GalleryMicrophoneIndicator recording={recording} level={snapshot.level} />
        <button
          type="button"
          className={`site-button ${preparing || recording ? 'site-button--slate' : 'site-button--blue'}`}
          disabled={disabled}
          aria-describedby={statusId}
          onClick={toggle}
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
                  : label}
        </button>
        <div className="gallery-welcome-capture-feedback">
          {children}
          {errorHelp}
        </div>
        <p id={statusId} role="status" className="gallery-visually-hidden">
          {recording ? 'Microphone listening' : 'Microphone off'}
        </p>
      </div>
    );

  const progress = snapshot.input.progress;
  // Only first-time setup needs visible status; a verified restart is normally brief.
  const settingUp =
    snapshot.input.phase === 'loading' ||
    (snapshot.input.phase === 'starting' && !snapshot.microphoneVerified);
  const status =
    snapshot.input.phase === 'loading'
      ? `Downloading speech model…${progress === undefined ? '' : ` ${Math.round(progress * 100)}%`}`
      : settingUp
        ? 'Allow microphone access in your browser.'
        : undefined;
  const action = snapshot.blocked
    ? 'Reload page'
    : preparing
      ? snapshot.input.phase === 'loading'
        ? 'Cancel download'
        : 'Cancel setup'
      : recording
        ? 'Pause'
        : stopping
          ? 'Stopping…'
          : failure.permissionDenied
            ? 'Try microphone again'
            : failed
              ? 'Try again'
              : label !== 'Start listening'
                ? label
                : 'Start';
  return (
    <>
      <GalleryDemoCapture>
        <div className="gallery-capture-controls gallery-capture-action">
          <p id={statusId} role="status" className={status ? undefined : 'gallery-visually-hidden'}>
            {status ?? (recording ? 'Listening locally' : 'Microphone off')}
          </p>
          <GalleryMicrophoneIndicator recording={recording} level={shownLevel} />
          <button
            type="button"
            className={`site-button gallery-capture-toggle ${preparing || recording ? 'site-button--slate' : 'site-button--blue'}`}
            disabled={disabled}
            aria-describedby={statusId}
            aria-label={
              snapshot.blocked || preparing || stopping || failed
                ? action
                : recording
                  ? 'Pause listening'
                  : label
            }
            onClick={toggle}
          >
            {action}
          </button>
        </div>
      </GalleryDemoCapture>
      {children}
      {errorHelp ??
        (failed && <GalleryMicrophoneRecovery failure={failure} blocked={snapshot.blocked} />)}
    </>
  );
};

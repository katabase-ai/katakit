import { useEffect, useId, useState, type ReactNode } from 'react';
import { GalleryDemoCapture } from './GalleryDemoHeader';
import { useGallerySpeech } from './GallerySpeechProvider';
import { GalleryMicrophoneIndicator } from './GalleryMicrophoneIndicator';

/**
 * Capture actions belong to the active demo, never the shared setup footer. Under the gallery's
 * header a demo's button sits below its description: a primary Start, then a secondary Pause. The
 * microphone glyph beside it fills with the level being heard.
 */
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
  // Raw levels jump between silence and full ten times a second. Rise at once but fall gradually,
  // so the glyph's fill reads as speech rather than flickering between empty and full.
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
  const preparing = ['loading', 'starting'].includes(snapshot.input.phase);
  const failure = snapshot.error ?? snapshot.input.error?.message;
  const disabled =
    snapshot.blocked || (!preparing && (snapshot.transitioning || !snapshot.attached));
  const toggle = () => void (preparing ? owner.cancel() : recording ? owner.stop() : owner.start());

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
          {preparing
            ? snapshot.input.phase === 'loading'
              ? 'Cancel download'
              : 'Cancel'
            : recording
              ? 'Stop listening'
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
  // Only a first-time setup is worth words: the model download, and the first permission prompt.
  // Once the microphone has worked this session, starting again passes through the same phases
  // in a moment, and naming them would flash text beside the button on every Start.
  const settingUp =
    snapshot.input.phase === 'loading' ||
    (snapshot.input.phase === 'starting' && !snapshot.microphoneVerified);
  const status =
    snapshot.input.phase === 'loading'
      ? `Downloading speech model…${progress === undefined ? '' : ` ${Math.round(progress * 100)}%`}`
      : settingUp
        ? 'Allow microphone access in your browser.'
        : undefined;
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
            className={`site-button gallery-capture-toggle ${
              settingUp || recording ? 'site-button--slate' : 'site-button--blue'
            }`}
            disabled={disabled}
            aria-describedby={statusId}
            // The button shows the short verb; its accessible name says what starts and pauses.
            aria-label={settingUp ? undefined : recording ? 'Pause listening' : label}
            onClick={toggle}
          >
            {settingUp
              ? 'Cancel'
              : recording
                ? 'Pause'
                : label !== 'Start listening'
                  ? label
                  : failure
                    ? 'Try again'
                    : 'Start'}
          </button>
        </div>
      </GalleryDemoCapture>
      {children}
      {errorHelp ??
        (failure && (
          <p role="alert">
            {failure}{' '}
            {snapshot.blocked
              ? 'Reload this page before trying again.'
              : 'Try downloading or starting again.'}
          </p>
        ))}
    </>
  );
};

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play } from 'lucide-react';
import { useGalleryDemoStage } from './GalleryDemoFrame';
import { GalleryDemoCapture } from './GalleryDemoHeader';
import { useGallerySpeech } from './GallerySpeechProvider';
import { GalleryMicrophoneIndicator } from './GalleryMicrophoneIndicator';

/**
 * Capture actions belong to the active demo, never the shared setup footer. In the gallery frame
 * a demo and its toolbar wait behind a Start overlay; after its first start the toolbar holds a
 * pause/resume button, which is the live microphone indicator.
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
  const stage = useGalleryDemoStage();
  const statusId = useId();
  // Each demo visit mounts its own controls, so this is "has this visit listened yet".
  const [started, setStarted] = useState(false);
  if (session?.snapshot.input.phase === 'running' && !started) setStarted(true);
  // Raw levels jump between silence and full ten times a second. Rise at once but fall gradually,
  // so the fill reads as speech rather than flickering between empty and full.
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
  const welcome = presentation === 'welcome';
  const failure = snapshot.error ?? snapshot.input.error?.message;
  // The overlay and Welcome show setup progress themselves; this line is for assistive tech.
  const statusLine = (
    <p id={statusId} role="status" className="gallery-visually-hidden">
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
      className={`site-button ${stage && !welcome ? 'site-button--blue gallery-capture-start' : 'site-button--slate'}`}
      disabled={snapshot.blocked || (!preparing && (snapshot.transitioning || !snapshot.attached))}
      aria-describedby={statusId}
      // Demos show the short verb; the accessible name still says what starts and stops.
      aria-label={welcome || preparing ? undefined : recording ? 'Stop listening' : label}
      onClick={() => void (preparing ? owner.cancel() : recording ? owner.stop() : owner.start())}
    >
      {preparing
        ? welcome && snapshot.input.phase === 'loading'
          ? 'Cancel download'
          : 'Cancel'
        : recording
          ? welcome
            ? 'Stop listening'
            : 'Stop'
          : welcome || label !== 'Start listening'
            ? label
            : failure
              ? 'Try again'
              : 'Start'}
    </button>
  );
  if (welcome)
    return (
      <div className="gallery-capture-controls gallery-welcome-capture-actions">
        <GalleryMicrophoneIndicator recording={recording} level={snapshot.level} />
        {button}
        <div className="gallery-welcome-capture-feedback">
          {children}
          {errorHelp}
        </div>
        {statusLine}
      </div>
    );
  const alert =
    errorHelp ??
    (failure && (
      <p role="alert">
        {failure}{' '}
        {snapshot.blocked
          ? 'Reload this page before trying again.'
          : 'Try downloading or starting again.'}
      </p>
    ));
  // A host without the gallery frame has no demo space to cover; it keeps a plain button.
  if (!stage)
    return (
      <>
        <div className="gallery-capture-controls gallery-capture-action">
          {statusLine}
          {button}
        </div>
        {children}
        {alert}
      </>
    );
  const progress = snapshot.input.progress;
  return (
    <>
      <GalleryDemoCapture>
        <div className="gallery-capture-controls gallery-capture-action">
          {started && (
            <button
              type="button"
              className="site-button site-button--icon gallery-capture-toggle"
              disabled={snapshot.blocked || snapshot.transitioning || preparing}
              aria-label={recording ? 'Pause listening' : 'Resume listening'}
              title={recording ? 'Pause' : 'Resume'}
              onClick={() => void (recording ? owner.stop() : owner.start())}
            >
              {recording && (
                // The whole button fills from the bottom with the level being heard.
                <span
                  className="gallery-capture-level"
                  aria-hidden="true"
                  style={{ '--gallery-capture-level': shownLevel } as CSSProperties}
                />
              )}
              {recording ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </button>
          )}
        </div>
      </GalleryDemoCapture>
      {/* Until this visit has listened once, and again after a failure, the demo waits behind Start. */}
      {(!started || !!failure || snapshot.blocked) &&
        createPortal(
          <div className="gallery-capture-controls gallery-capture-overlay">
            <div className="gallery-capture-overlay-card">
              {alert}
              {preparing && (
                <>
                  <p>
                    {snapshot.input.phase === 'loading'
                      ? `Downloading speech model…${progress === undefined ? '' : ` ${Math.round(progress * 100)}%`}`
                      : 'Allow microphone access in your browser.'}
                  </p>
                  {snapshot.input.phase === 'loading' && (
                    <progress
                      className="gallery-welcome-download-progress"
                      aria-label="Speech model download"
                      max={1}
                      value={
                        progress === undefined ? undefined : Math.max(0, Math.min(1, progress))
                      }
                    />
                  )}
                </>
              )}
              {statusLine}
              {button}
            </div>
          </div>,
          stage
        )}
      {children}
    </>
  );
};

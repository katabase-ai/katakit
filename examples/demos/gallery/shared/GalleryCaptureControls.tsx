import {
  useContext,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { GalleryDemoCapture } from './GalleryDemoHeader';
import { useGallerySpeech } from './GallerySpeechProvider';
import { GalleryMicrophoneIndicator } from './GalleryMicrophoneIndicator';
import { GalleryTermsContext } from './GalleryTermsContext';
import { galleryTermsNotice, useGalleryConsent } from './GalleryConsentProvider';
import './galleryCaptureControls.css';

type SpeechCaptureProps = {
  label?: string;
  /** Replaces default errors; Welcome presents this guidance beside its action. */
  errorHelp?: ReactNode;
  children?: ReactNode;
  /** Welcome uses a passive mic glyph and keeps capture status accessible without a meter. */
  presentation?: 'default' | 'welcome';
};

/** One button presentation for shared speech capture and host-owned actions such as timed games. */
const CaptureButton = ({
  secondary,
  className = '',
  ...button
}: ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean; children: string }) => {
  const termsUrl = useContext(GalleryTermsContext);
  const consent = useGalleryConsent();
  const consentId = useId();
  const showConsent = !!termsUrl && !secondary && !consent?.accepted;
  return (
    <>
      <button
        {...button}
        type="button"
        onClick={event => {
          // The primary click accepts the notice even if model/microphone setup later fails.
          if (showConsent)
            consent?.accept({
              buttonLabel: button.children,
              termsUrl,
              noticeText: `${galleryTermsNotice.beforeLink}${galleryTermsNotice.linkText}${galleryTermsNotice.afterLink}`,
            });
          button.onClick?.(event);
        }}
        aria-describedby={
          [button['aria-describedby'], showConsent ? consentId : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
        className={`site-button ${secondary ? 'site-button--slate' : 'site-button--blue'} ${className}`.trim()}
      />
      {showConsent && (
        <span id={consentId} className="gallery-capture-consent">
          {galleryTermsNotice.beforeLink}
          <a href={termsUrl} target="_blank" rel="noopener noreferrer">
            {galleryTermsNotice.linkText}
          </a>
          {galleryTermsNotice.afterLink}
        </span>
      )}
    </>
  );
};

/**
 * Capture actions belong to the active demo, never the shared setup footer. Listening demos use
 * the shared speech owner and header placement. A controlled action stays where its host renders
 * it and leaves setup, cancellation, and game timing with that host; it needs no speech provider.
 */
export const GalleryCaptureControls = (
  props:
    | SpeechCaptureProps
    | {
        action: {
          label: string;
          onClick: () => void;
          disabled?: boolean;
          secondary?: boolean;
          className?: string;
        };
      }
) => {
  if ('action' in props) {
    const { label, ...button } = props.action;
    return <CaptureButton {...button}>{label}</CaptureButton>;
  }
  return <SpeechCaptureControls {...props} />;
};

const SpeechCaptureControls = ({
  label = 'Start listening',
  errorHelp,
  children,
  presentation = 'default',
}: SpeechCaptureProps) => {
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
        <CaptureButton
          secondary={preparing || recording}
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
        </CaptureButton>
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
          <CaptureButton
            className="gallery-capture-toggle"
            secondary={settingUp || recording}
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
          </CaptureButton>
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

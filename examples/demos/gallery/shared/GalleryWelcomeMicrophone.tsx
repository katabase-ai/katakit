import { useEffect, useState } from 'react';
import { createTranscriptionDemo } from '../../transcription-react/src/createTranscriptionDemo';
import { GalleryDemo } from './GalleryDemo';
import { GalleryCaptureControls } from './GalleryCaptureControls';
import { GalleryMicrophoneIndicator } from './GalleryMicrophoneIndicator';
import { useGallerySpeech } from './GallerySpeechProvider';

const TestTranscript = ({ runtime }: { runtime: ReturnType<typeof createTranscriptionDemo> }) => {
  const [snapshot, setSnapshot] = useState(() => runtime.state$.getValue());
  useEffect(() => {
    const subscription = runtime.state$.subscribe(setSnapshot);
    return () => subscription.unsubscribe();
  }, [runtime]);
  const text = [
    ...snapshot.completedTurns.map(turn => turn.text),
    snapshot.currentTurn?.text,
    snapshot.provisional,
  ]
    .filter(Boolean)
    .join(' ');
  return <>{text || 'Your words will appear here.'}</>;
};

const MicrophoneRecovery = () => {
  const session = useGallerySpeech();
  if (!session) return null;
  const { snapshot } = session;
  // Color Clash also prioritizes owner failures over an older typed input error.
  const inputError = snapshot.input.error;
  const code =
    !snapshot.blocked && (!snapshot.error || snapshot.error === inputError?.message)
      ? inputError?.code
      : undefined;
  const permissionDenied = code === 'microphone-permission-denied';
  const message = permissionDenied
    ? 'If your browser has blocked this site, allow Microphone in site settings first.'
    : code === 'microphone-unavailable'
      ? 'Connect a microphone and check that it is selected in your browser or computer’s sound settings, then try again.'
      : code === 'model-load-failed'
        ? 'The speech model could not load. Check your internet connection, then try again.'
        : code === 'unsupported-environment'
          ? 'This browser cannot run local microphone transcription here. Try an up-to-date browser with microphone support, using HTTPS or localhost.'
          : code === 'cross-origin-isolation-required'
            ? 'This site is missing settings needed for local transcription. Contact the site owner for help.'
            : snapshot.error ||
              inputError?.message ||
              'The microphone test could not finish. Try again.';
  return (
    <>
      <div role="alert">
        {permissionDenied && <p>Allow microphone access to test local transcription.</p>}
        <p>{message}</p>
        {snapshot.blocked && <p>Reload this page before trying again.</p>}
      </div>
      {permissionDenied && (
        <details className="gallery-microphone-help">
          <summary>How to enable your microphone</summary>
          <ol>
            <li>Open this site's permissions beside your browser's address bar.</li>
            <li>Set Microphone to Allow, or reset the blocked permission.</li>
            <li>Return here and choose Try microphone again.</li>
          </ol>
          <p>
            Still blocked? Check that your computer's privacy settings allow your browser to use the
            microphone.
          </p>
        </details>
      )}
    </>
  );
};

export const GalleryWelcomeMicrophone = () => {
  const session = useGallerySpeech();
  const snapshot = session?.snapshot;
  const failed = !!(snapshot?.blocked || snapshot?.error || snapshot?.input.error);
  const successful = !!snapshot?.microphoneVerified && !failed;
  const loading = snapshot?.input.phase === 'loading';
  const permissionDenied =
    !snapshot?.blocked &&
    (!snapshot?.error || snapshot.error === snapshot.input.error?.message) &&
    snapshot?.input.error?.code === 'microphone-permission-denied';
  const detail =
    failed || successful
      ? undefined
      : loading
        ? `Downloading speech model…${snapshot.input.progress === undefined ? '' : ` ${Math.round(snapshot.input.progress * 100)}%`}`
        : snapshot?.input.phase === 'starting'
          ? 'Allow microphone access in your browser to finish setup.'
          : snapshot?.starting
            ? 'Preparing microphone…'
            : undefined;
  const progress = snapshot?.input.progress;
  return (
    <section className="gallery-microphone-test" aria-labelledby="gallery-test-title">
      <div className="gallery-welcome-microphone-heading">
        <h2 id="gallery-test-title">Set up your mic</h2>
      </div>
      <p>
        All demos in this gallery turn speech into text right in your browser. Your audio data
        always stays on your device.
      </p>
      {snapshot?.blocked ? (
        <div className="gallery-capture-controls gallery-welcome-capture-actions">
          <GalleryMicrophoneIndicator recording={false} level={0} />
          <button type="button" className="site-button" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <div className="gallery-welcome-capture-feedback">
            {snapshot.modelDownloaded && (
              <p role="status">Transcription model successfully downloaded</p>
            )}
            <MicrophoneRecovery />
          </div>
        </div>
      ) : (
        <GalleryCaptureControls
          presentation="welcome"
          label={
            failed
              ? permissionDenied
                ? 'Try microphone again'
                : 'Try again'
              : successful
                ? 'Test again'
                : 'Set up microphone'
          }
          errorHelp={failed ? <MicrophoneRecovery /> : undefined}
        >
          {snapshot?.modelDownloaded && !loading && (
            <p role="status">Transcription model successfully downloaded</p>
          )}
          {detail && <p role="status">{detail}</p>}
          {loading && (
            <progress
              className="gallery-welcome-download-progress"
              aria-label="Speech model download"
              max={1}
              value={progress === undefined ? undefined : Math.max(0, Math.min(1, progress))}
            />
          )}
        </GalleryCaptureControls>
      )}
      <div
        className="gallery-test-transcript"
        role="log"
        aria-label="Test transcript"
        aria-live="polite"
      >
        {snapshot?.blocked ? (
          'Your words will appear here.'
        ) : (
          <GalleryDemo
            create={createTranscriptionDemo}
            render={runtime => <TestTranscript runtime={runtime} />}
          />
        )}
      </div>
    </section>
  );
};

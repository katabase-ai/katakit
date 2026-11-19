import {
  GalleryMicrophoneRecovery,
  getGalleryMicrophoneFailure,
} from './GalleryMicrophoneRecovery';
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
  return (
    <GalleryMicrophoneRecovery
      failure={getGalleryMicrophoneFailure(session.snapshot)}
      blocked={session.snapshot.blocked}
    />
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

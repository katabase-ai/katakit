import { useEffect, useState } from 'react';
import { createTranscriptionDemo } from '../../transcription-react/src/createTranscriptionDemo';
import { GalleryDemo } from './GalleryDemo';
import { GalleryCaptureControls } from './GalleryCaptureControls';

const MicrophoneTest = ({ runtime }: { runtime: ReturnType<typeof createTranscriptionDemo> }) => {
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
  return (
    <section className="gallery-microphone-test" aria-labelledby="gallery-test-title">
      <h2 id="gallery-test-title">Try your microphone</h2>
      <p>
        Say a few words and watch them appear. The first test downloads a model before asking for
        microphone access.
      </p>
      <GalleryCaptureControls label="Test transcription" />
      <p className="gallery-test-transcript" aria-label="Test transcript" aria-live="polite">
        {text || 'Your words will appear here.'}
      </p>
      {text && <p role="status">Your microphone and transcription are working.</p>}
    </section>
  );
};

export const GalleryWelcome = ({ privacyUrl }: { privacyUrl?: string }) => (
  <div className="gallery-welcome">
    <h1>Welcome</h1>
    <p className="gallery-intro">
      Small apps that turn conversation into something useful. Choose a demo, or try your microphone
      here first. Your browser loads a speech model once and keeps it ready as you explore.
    </p>
    <GalleryDemo
      create={createTranscriptionDemo}
      render={runtime => <MicrophoneTest runtime={runtime} />}
    />
    <p className="gallery-privacy">
      Audio stays on your device. You choose when to share transcript text.{' '}
      {privacyUrl && (
        <a href={privacyUrl} target="_blank" rel="noopener noreferrer">
          Privacy
        </a>
      )}
    </p>
  </div>
);

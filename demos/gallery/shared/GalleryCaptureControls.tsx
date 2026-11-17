import { useId } from 'react';
import { AudioLevelMeter, Button } from '@katakit/site-ui';
import { useGallerySpeech } from './GallerySpeechProvider';

/** Capture actions belong to the active demo, never the shared setup footer. */
export const GalleryCaptureControls = ({ label = 'Start listening' }: { label?: string }) => {
  const session = useGallerySpeech();
  const statusId = useId();
  if (!session) return <p role="status">Preparing microphone…</p>;
  const { owner, snapshot } = session;
  const recording = snapshot.input.phase === 'running';
  const preparing = ['loading', 'starting'].includes(snapshot.input.phase);
  return (
    <div className="gallery-capture-controls">
      <Button
        disabled={
          snapshot.blocked || (!preparing && (snapshot.transitioning || !snapshot.attached))
        }
        aria-describedby={statusId}
        onClick={() => void (preparing ? owner.cancel() : recording ? owner.stop() : owner.start())}
      >
        {preparing ? 'Cancel' : recording ? 'Stop listening' : label}
      </Button>
      <p id={statusId} role="status">
        {snapshot.input.phase === 'loading'
          ? `Downloading model${snapshot.input.progress === undefined ? '…' : `: ${Math.round(snapshot.input.progress * 100)}%`} · microphone off`
          : snapshot.input.phase === 'starting'
            ? 'Waiting for microphone permission…'
            : recording
              ? 'Listening locally'
              : snapshot.transitioning
                ? 'Finishing input…'
                : 'Microphone off'}
      </p>
      {recording && <AudioLevelMeter active level={snapshot.level} />}
      {(snapshot.error || snapshot.input.error) && (
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

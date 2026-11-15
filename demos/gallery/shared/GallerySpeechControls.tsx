import type { ReactNode } from 'react';
import { transcriptionModels, type TranscriptionModelId } from '@katakit/transcription/browser';
import { AudioLevelMeter, Button, SelectField } from '@katakit/site-ui';
import { useGallerySpeech } from './GallerySpeechProvider';

/** The private host may supply its own Select without making public examples depend on it. */
export type GalleryModelSelect = (props: {
  model: TranscriptionModelId;
  disabled: boolean;
  onChange: (model: TranscriptionModelId) => void;
}) => ReactNode;

export const GallerySpeechControls = ({
  renderModelSelect,
}: {
  renderModelSelect?: GalleryModelSelect;
}) => {
  const session = useGallerySpeech();
  if (!session) return <p role="status">Preparing controls…</p>;
  const { owner, snapshot } = session;
  const recording = snapshot.input.phase === 'running';
  const disabled = snapshot.transitioning || snapshot.blocked;
  const select = (model: TranscriptionModelId) => {
    void owner.select(model);
  };
  return (
    <div className="gallery-speech-controls">
      {renderModelSelect ? (
        renderModelSelect({
          model: snapshot.model,
          disabled: disabled || recording,
          onChange: select,
        })
      ) : (
        <SelectField
          id="gallery-model"
          label="Transcription model"
          value={snapshot.model}
          disabled={disabled || recording}
          onChange={event => select(event.target.value as TranscriptionModelId)}
        >
          {transcriptionModels.map(model => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </SelectField>
      )}
      <div className="gallery-speech-actions">
        <Button
          disabled={disabled || recording || snapshot.input.phase === 'ready'}
          onClick={() => void owner.load()}
        >
          Load model
        </Button>
        <Button disabled={disabled} onClick={() => void (recording ? owner.stop() : owner.start())}>
          {recording ? 'Stop recording' : 'Start recording'}
        </Button>
      </div>
      <p role="status" aria-live="polite">
        {snapshot.input.phase === 'loading'
          ? `Loading model${snapshot.input.progress === undefined ? '…' : `: ${Math.round(snapshot.input.progress * 100)}%`}`
          : recording
            ? 'Listening locally'
            : snapshot.transitioning
              ? 'Finishing input…'
              : snapshot.input.phase === 'ready'
                ? 'Model ready · microphone off'
                : 'Microphone off'}
      </p>
      <AudioLevelMeter active={recording} level={snapshot.level} />
      {(snapshot.error || snapshot.input.error) && (
        <p role="alert">
          {snapshot.error ?? snapshot.input.error?.message}{' '}
          {snapshot.blocked
            ? 'Reload this page before trying again.'
            : 'Try loading or starting again.'}
        </p>
      )}
      <p className="gallery-processing-notice">
        Recognition runs in this browser. Model files download on first load. Audio and transcripts
        stay in memory; leaving a demo clears its conversation.{' '}
        {snapshot.model === 'whisper-tiny'
          ? 'Whisper uses ten-second chunks, with a final partial chunk when you stop.'
          : 'Moonshine streams English speech with a live preview.'}
      </p>
    </div>
  );
};

import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import { AudioLevelMeter } from './ui/AudioLevelMeter';
import { Button, Notice, SelectField } from './ui/controls';
import { createMicrophoneTranscriber } from '@katakit/transcription/browser';
import type { TranscriptionState } from '@katakit/transcription';
import { defaultModel, models, type ModelId } from './models';
import { createModelSwitcher } from './createModelSwitcher';
import { createTranscriptionDemo } from './createTranscriptionDemo';
import { TranscriptionDemo as TranscriptView } from './TranscriptionDemo';
import './ui/base.css';
import './style.css';

/** Standalone ownership stays in this example, with no gallery dependency. */
const TranscriptionDemo = () => {
  const [runtime, setRuntime] = useState<ReturnType<typeof createTranscriptionDemo>>();
  const [input, setInput] = useState<TranscriptionState>({ phase: 'idle' });
  const [audioLevel, setAudioLevel] = useState(0);
  const [modelId, setModelId] = useState<ModelId>(defaultModel);
  const [switching, setSwitching] = useState(false);
  const owner = useRef<ReturnType<typeof createModelSwitcher> | undefined>(undefined);
  const switchingRef = useRef(false);

  useEffect(() => {
    const currentRuntime = createTranscriptionDemo();
    let phase: TranscriptionState['phase'] = 'idle';
    let mounted = true;
    const current = createModelSwitcher(defaultModel, model =>
      createMicrophoneTranscriber({
        model,
        onState: state => {
          phase = state.phase;
          if (mounted) setInput(state);
        },
        onLevel: level => {
          if (mounted) setAudioLevel(level);
        },
        onFinal: currentRuntime.ingestSegment,
        onProvisional: currentRuntime.updateProvisional,
        onStop: currentRuntime.flush,
      })
    );
    setRuntime(currentRuntime);
    owner.current = current;
    return () => {
      mounted = false;
      owner.current = undefined;
      void (async () => {
        try {
          try {
            if (phase === 'running') await current.stop();
          } finally {
            try {
              await current.dispose();
            } finally {
              currentRuntime.close();
            }
          }
        } catch (error) {
          reportError(error);
        }
      })();
    };
  }, []);

  const selectModel = async (id: ModelId) => {
    if (id === modelId || switchingRef.current || !owner.current) return;
    switchingRef.current = true;
    setSwitching(true);
    try {
      if (await owner.current.select(id)) {
        setAudioLevel(0);
        runtime?.flush();
        setModelId(id);
        setInput({ phase: 'idle' });
      }
    } finally {
      switchingRef.current = false;
      setSwitching(false);
    }
  };

  const toggleRecording = async () => {
    try {
      await (input.phase === 'running' ? owner.current?.stop() : owner.current?.start());
    } catch {
      /* onState exposes an actionable error in the UI. */
    }
  };

  const recording = input.phase === 'running';
  const busy = switching || ['loading', 'starting', 'stopping'].includes(input.phase);
  const available =
    window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === 'function';
  if (!runtime) return <p role="status">Preparing transcript…</p>;
  return (
    <TranscriptView
      runtime={runtime}
      controls={
        <>
          <div className="model-picker">
            <SelectField
              id="transcription-model"
              label="Transcription model"
              hint={`${models.find(model => model.id === modelId)?.detail}. Change models between recordings.`}
              value={modelId}
              disabled={busy || recording}
              onChange={event => void selectModel(event.target.value as ModelId)}
            >
              {models.map(model => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="controls">
            <Button
              variant={recording ? 'border' : 'blue'}
              className="record-button"
              data-recording={recording}
              disabled={busy || !available}
              onClick={() => {
                if (switchingRef.current) return;
                void toggleRecording();
              }}
            >
              <span className="record-icon" aria-hidden="true" />
              {recording
                ? 'Stop recording'
                : switching
                  ? 'Switching…'
                  : busy
                    ? `${input.phase}…`
                    : 'Start recording'}
            </Button>
            <span className="phase" role="status" aria-live="polite">
              {input.phase === 'loading'
                ? `Loading on-device model${input.progress === undefined ? '' : ` · ${Math.round(input.progress * 100)}%`}`
                : input.phase === 'running'
                  ? 'Listening locally'
                  : input.phase === 'error'
                    ? 'Recording unavailable'
                    : 'Mic is off'}
            </span>
          </div>

          <div className="transcription-audio-level">
            <AudioLevelMeter active={recording} level={audioLevel} />
          </div>

          {!available && (
            <Notice tone="error">
              This browser needs microphone access and cross-origin isolation. Open the demo on
              localhost or an HTTPS host configured with COOP/COEP headers.
            </Notice>
          )}
          {input.error && (
            <Notice tone="error">
              {input.error.message} Try starting again or check microphone permission.
            </Notice>
          )}
        </>
      }
    />
  );
};

const App = () => (
  <main className="shell">
    <TranscriptionDemo />
  </main>
);

createRoot(document.getElementById('root')!).render(<App />);

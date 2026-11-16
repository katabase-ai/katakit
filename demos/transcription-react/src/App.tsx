import { useEffect, useRef, useState } from 'react';
import { combineLatest } from 'rxjs';
import { makeKatakit } from '@katakit/core';
import { bind, Subscribe } from '@react-rxjs/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import { AudioLevelMeter } from './AudioLevelMeter';
import { Button, Notice, SelectField } from './controls';
import { createMicrophoneTranscriber } from '@katakit/transcription/browser';
import type { TranscriptionState } from '@katakit/transcription';
import { defaultModel, models, type ModelId } from './models';
import { createModelSwitcher } from './createModelSwitcher';

const TranscriptIngestionPlugin = makeTranscriptIngestionPlugin({ turnSilenceMs: 1400 });
const kit = makeKatakit({ plugins: [TranscriptIngestionPlugin.configure({})] });
const methods = kit.start().getMethods(TranscriptIngestionPlugin);
const { conversationTurns$, currentTurn$, provisional$ } =
  kit.getObservables(TranscriptIngestionPlugin);
const [useCompletedTurns, completedTurnsState$] = bind(conversationTurns$);
const [useCurrentTurn, currentTurnState$] = bind(currentTurn$);
const [useProvisional, provisionalState$] = bind(provisional$);
const view$ = combineLatest([completedTurnsState$, currentTurnState$, provisionalState$]);

const formatTime = (ms?: number) => {
  if (ms === undefined) return undefined;
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

const TranscriptionView = () => {
  const completedTurns = useCompletedTurns();
  const currentTurn = useCurrentTurn();
  const provisional = useProvisional();
  const [input, setInput] = useState<TranscriptionState>({ phase: 'idle' });
  const [audioLevel, setAudioLevel] = useState(0);
  const [modelId, setModelId] = useState<ModelId>(defaultModel);
  const [switching, setSwitching] = useState(false);
  const owner = useRef<ReturnType<typeof createModelSwitcher> | null>(null);
  const switchingRef = useRef(false);

  const makeInput = (id: ModelId) => {
    const callbacks = {
      onState: setInput,
      onLevel: setAudioLevel,
      onFinal: methods.ingestSegment,
      onStop: methods.flush,
    };
    return createMicrophoneTranscriber({
      ...callbacks,
      model: id,
      onProvisional: methods.updateProvisional,
    });
  };

  useEffect(() => {
    const current = createModelSwitcher(defaultModel, makeInput);
    owner.current = current;
    return () => {
      owner.current = null;
      void current.dispose();
    };
  }, []);

  const selectModel = async (id: ModelId) => {
    if (id === modelId || switchingRef.current || !owner.current) return;
    switchingRef.current = true;
    setSwitching(true);
    try {
      if (await owner.current.select(id)) {
        setAudioLevel(0);
        methods.flush();
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
    window.isSecureContext &&
    window.crossOriginIsolated &&
    typeof navigator.mediaDevices?.getUserMedia === 'function';
  const turns = currentTurn ? [...completedTurns, currentTurn] : completedTurns;

  return (
    <section className="workspace transcription-demo" aria-labelledby="title">
      <div className="intro">
        <h1 id="title">Conversation, in text.</h1>
        <p>Record in your browser. Read each conversation turn as it finishes.</p>
      </div>

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

      <section className="transcript" aria-labelledby="transcript-heading">
        <div className="transcript-heading">
          <h2 id="transcript-heading">Transcript</h2>
          <span>{completedTurns.length} completed turns</span>
        </div>

        {!turns.length && !provisional ? (
          <div className="empty-state">
            <p>Your conversation will appear here.</p>
            <span>Speak naturally; short transcript fragments will be grouped into turns.</span>
          </div>
        ) : (
          <div className="turn-list" aria-live="polite" aria-relevant="additions text">
            {turns.map((turn, index) => (
              <article className="turn" key={turn.id}>
                <span className="turn-index">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <p>{turn.text}</p>
                  {turn === currentTurn && <span className="working">Turn in progress</span>}
                </div>
                <time>{formatTime(turn.startMs)}</time>
              </article>
            ))}
            {provisional && (
              <div className="turn interim">
                <span className="turn-index">··</span>
                <p>{provisional}</p>
                <span className="working">Listening</span>
              </div>
            )}
          </div>
        )}
      </section>
      <footer>
        English-only models. Audio stays in this browser. Transcript is cleared on reload.
      </footer>
    </section>
  );
};

export const TranscriptionDemo = () => (
  <Subscribe source$={view$}>
    <TranscriptionView />
  </Subscribe>
);

export const App = () => (
  <main className="shell">
    <header className="topbar">
      <span className="brand">Katakit</span>
      <span className="topbar-note">A transcription demo</span>
    </header>
    <TranscriptionDemo />
  </main>
);

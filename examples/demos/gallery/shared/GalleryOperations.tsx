import { useContext, useEffect, useState } from 'react';
import { transcriptionModels, type TranscriptionModelId } from '@katakit/transcription/browser';
import { useGallerySpeech } from './GallerySpeechProvider';
import { useGalleryInference } from './GalleryInferenceProvider';
import { useGalleryMode } from './GalleryModeProvider';
import { GalleryModelContext } from './galleryModel';
import { galleryOperations } from './operationDetails';
import type { Gallery } from './Gallery';

/** Developer configuration is scoped to implemented operations; no account/unsupported-model placeholders. */
export const GalleryOperationSetup = () => {
  const { editing } = useGalleryMode();
  const inference = useGalleryInference();
  const speech = useGallerySpeech();
  const { hostAvailable } = useContext(GalleryModelContext);
  const initial = () =>
    inference && !hostAvailable && inference.settings.source === 'free'
      ? { ...inference.settings, source: 'key' as const }
      : inference?.settings;
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Reset stale drafts after another tab changes/removes a key, preserving the removal invariant.
  useEffect(() => {
    setDraft(initial());
  }, [inference?.settings, hostAvailable]);
  if (!editing) return null;
  if (!inference || !speech || !draft) return <p role="status">Preparing operation settings…</p>;
  const apply = (action: () => void, message: string) => {
    try {
      action();
      setError('');
      setNotice(message);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Could not save settings.');
      setNotice('');
    }
  };
  const { snapshot, owner } = speech;
  const loading = snapshot.input.phase === 'loading';
  const ready = ['ready', 'running', 'starting', 'stopping'].includes(snapshot.input.phase);
  const locked =
    snapshot.blocked ||
    snapshot.transitioning ||
    ['loading', 'running', 'starting', 'stopping'].includes(snapshot.input.phase);
  return (
    <section className="gallery-developer-page" aria-label="Operation Setup">
      <h1>Operation Setup</h1>
      <p>
        An operation is a kind of work a demo needs. Choose how each operation runs; saved
        selections apply across demos.
      </p>
      <aside className="gallery-managed-card">
        <h2>Managed inference, without an API key.</h2>
        <p>
          {hostAvailable
            ? 'Free demo uses the service supplied by this host. No provider or model choices are needed.'
            : 'This host has no managed inference service. Local transcription works independently; developer mode can use your OpenRouter key.'}
        </p>
        {hostAvailable && (
          <button
            type="button"
            className="site-button"
            onClick={() =>
              apply(
                () => inference.owner.save({ ...inference.settings, source: 'free' }),
                'Free demo selected. Start notes in a demo when ready.'
              )
            }
          >
            Use free demo
          </button>
        )}
      </aside>
      <section
        id="transcription"
        className="gallery-operation-section"
        aria-labelledby="gallery-audio-title"
      >
        <h2 id="gallery-audio-title">
          Audio <span>Speech on your device</span>
        </h2>
        <div className="gallery-setup-row">
          <div>
            <h3>Transcription</h3>
            <p>{ready ? 'Model ready' : 'Model selected · download required'}</p>
          </div>
          <div>
            <span className="gallery-field-label">Provider</span>
            <p>Local</p>
          </div>
          <label>
            Model
            <select
              aria-label="Transcription model"
              value={snapshot.model}
              disabled={locked}
              onChange={event => void owner.select(event.target.value as TranscriptionModelId)}
            >
              {transcriptionModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className="site-button"
          disabled={snapshot.blocked || (!loading && (snapshot.transitioning || ready))}
          onClick={() => void (loading ? owner.cancel() : owner.load())}
        >
          {loading ? 'Cancel download' : ready ? 'Downloaded' : 'Download model'}
        </button>
        <p role="status">
          {loading
            ? `Downloading${snapshot.input.progress === undefined ? '…' : ` ${Math.round(snapshot.input.progress * 100)}%`} · microphone off`
            : 'Downloading leaves the microphone off. Start listening inside a demo.'}
        </p>
        {(snapshot.error || snapshot.input.error) && (
          <p role="alert">{snapshot.error ?? snapshot.input.error?.message}</p>
        )}
      </section>
      <section
        id="inference"
        className="gallery-operation-section"
        aria-labelledby="gallery-language-title"
      >
        <h2 id="gallery-language-title">
          Language <span>Generate output from transcript text</span>
        </h2>
        <form
          className="gallery-inference-form"
          onSubmit={event => {
            event.preventDefault();
            apply(
              () => inference.owner.save(draft),
              'Inference settings saved. Start notes in a demo when ready.'
            );
          }}
        >
          <div className="gallery-setup-row">
            <div>
              <h3>Inference</h3>
              <p>
                {inference.settings.source === 'key'
                  ? 'Developer key selected'
                  : hostAvailable
                    ? 'Free demo selected'
                    : 'Needs a connection'}
              </p>
            </div>
            <label>
              Provider
              <select
                aria-label="Inference source"
                value={draft.source}
                onChange={event =>
                  setDraft({ ...draft, source: event.target.value as 'free' | 'key' })
                }
              >
                <option value="free" disabled={!hostAvailable}>
                  Free demo
                </option>
                <option value="key">OpenRouter · My API key</option>
              </select>
            </label>
            <div>
              <span className="gallery-field-label">Model</span>
              <p>{draft.source === 'key' ? draft.model : 'Host default'}</p>
            </div>
          </div>
          {draft.source === 'key' && (
            <>
              <div className="gallery-key-fields">
                <label htmlFor="gallery-api-key">
                  API key
                  <input
                    id="gallery-api-key"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={draft.key}
                    onChange={event => setDraft({ ...draft, key: event.target.value })}
                  />
                </label>
                <label htmlFor="gallery-inference-model">
                  Model ID
                  <input
                    id="gallery-inference-model"
                    value={draft.model}
                    spellCheck={false}
                    onChange={event => setDraft({ ...draft, model: event.target.value })}
                  />
                </label>
              </div>
              <p>
                Choose an OpenRouter model ID. Structured notes needs JSON schema output. The key
                authorizes your account; the model field chooses what runs.{' '}
                <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer">
                  Browse models
                </a>
              </p>
              <p className="gallery-settings-note">
                Saved in this browser’s local storage, including after tab closure. Developer
                requests go directly to your endpoint using your provider credits. Public preview
                ignores these settings.
              </p>
              <details>
                <summary>Advanced</summary>
                <label htmlFor="gallery-inference-endpoint">
                  Chat-completions endpoint
                  <input
                    id="gallery-inference-endpoint"
                    type="url"
                    value={draft.endpoint}
                    spellCheck={false}
                    onChange={event => setDraft({ ...draft, endpoint: event.target.value })}
                  />
                </label>
                <p>
                  Use an OpenAI-compatible endpoint with JSON schema output and browser access
                  (CORS). Your key and transcript go to this URL.
                </p>
              </details>
            </>
          )}
          <p>
            Saving pauses inference. Start notes in the demo to resume; local capture can continue.
          </p>
          <div className="gallery-settings-actions">
            <button type="submit" className="site-button">
              Save
            </button>
            {inference.settings.key && (
              <button
                type="button"
                className="site-button site-button--ghost"
                onClick={() =>
                  apply(
                    inference.owner.remove,
                    'Saved key removed. Public preview never uses a developer key.'
                  )
                }
              >
                Remove key
              </button>
            )}
            <button
              type="button"
              className="site-button site-button--ghost"
              onClick={() => {
                setDraft(initial());
                setError('');
                setNotice('');
              }}
            >
              Reset changes
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
        </form>
      </section>
    </section>
  );
};

/** Required-operation matrix comes from the same catalogue as navigation, not a second demo list. */
export const GalleryOperationGrid = ({
  demos,
  renderLink,
}: Pick<Parameters<typeof Gallery>[0], 'demos' | 'renderLink'>) => {
  const { editing } = useGalleryMode();
  const { connect, configure } = useContext(GalleryModelContext);
  if (!editing) return null;
  return (
    <section className="gallery-developer-page" aria-label="Operation Grid">
      <h1>Operation Grid</h1>
      <p>
        See which operations each demo needs. Select an operation to configure it, or a demo to open
        it.
      </p>
      <p>
        Configured means a model or managed connection is selected. Downloads, microphone
        permission, and provider availability are checked when you start.
      </p>
      <div className="gallery-grid-scroll">
        <table className="gallery-operation-grid">
          <caption className="gallery-visually-hidden">Required operations for each demo</caption>
          <thead>
            <tr>
              <th rowSpan={2} scope="col">
                Demo
              </th>
              <th scope="colgroup">Audio</th>
              <th scope="colgroup">Language</th>
            </tr>
            <tr>
              {galleryOperations.map(operation => (
                <th key={operation.id} scope="col">
                  <button type="button" onClick={() => configure?.(operation.id)}>
                    {operation.title}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {demos.map(demo => (
              <tr key={demo.id}>
                <th scope="row">{renderLink({ demo, children: demo.title, current: false })}</th>
                {galleryOperations.map(operation => {
                  const required = (demo.capabilities as readonly string[]).includes(
                    operation.capability
                  );
                  const configured = operation.id === 'transcription' || !!connect;
                  const label = !required
                    ? 'Not used'
                    : configured
                      ? 'Required · configured'
                      : 'Required · needs a connection';
                  return (
                    <td key={operation.id}>
                      <span
                        className={
                          required && !configured ? 'gallery-operation-missing' : undefined
                        }
                        role="img"
                        aria-label={`${operation.title}: ${label}`}
                      >
                        {!required ? '—' : configured ? '●' : '○'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="gallery-grid-legend">
        ● Required · configured　 ○ Required · needs a connection　 — Not used
      </p>
    </section>
  );
};

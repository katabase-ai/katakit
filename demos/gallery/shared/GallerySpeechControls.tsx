import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefCallback,
} from 'react';
import { Button } from '@katakit/site-ui';
import type { TranscriptionModelId } from '@katakit/transcription/browser';
import { useGallerySpeech } from './GallerySpeechProvider';
import { useGalleryInference } from './GalleryInferenceProvider';
import { GalleryModelContext } from './galleryModel';

/** Legacy host renderer type. Launch defaults no longer need an upfront model selector. */
export type GalleryModelSelect = (props: {
  model: TranscriptionModelId;
  disabled: boolean;
  onChange: (model: TranscriptionModelId) => void;
}) => ReactNode;

const InferenceSettings = ({ close }: { close: () => void }) => {
  const session = useGalleryInference()!;
  const { hostAvailable } = useContext(GalleryModelContext);
  const [draft, setDraft] = useState(() =>
    !hostAvailable && session.settings.source === 'free'
      ? { ...session.settings, source: 'key' as const }
      : session.settings
  );
  // A storage event can remove a key while this dialog is open. Do not let an
  // earlier draft silently restore it when the visitor next presses Save.
  useEffect(() => {
    setDraft(
      !hostAvailable && session.settings.source === 'free'
        ? { ...session.settings, source: 'key' }
        : session.settings
    );
  }, [hostAvailable, session.settings]);
  const [error, setError] = useState('');
  const apply = (action: () => void) => {
    try {
      action();
      close();
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Could not save settings.');
    }
  };
  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        apply(() => session.owner.save(draft));
      }}
    >
      <h2>Inference</h2>
      <p>Choose where transcript text goes when you start notes.</p>
      <fieldset>
        <legend>Source</legend>
        <label>
          <input
            type="radio"
            name="source"
            checked={draft.source === 'free'}
            disabled={!hostAvailable}
            onChange={() => setDraft({ ...draft, source: 'free' })}
          />{' '}
          Free demo
        </label>
        {!hostAvailable && <p>This host has no free inference service. Use your own key below.</p>}
        <label>
          <input
            type="radio"
            name="source"
            checked={draft.source === 'key'}
            onChange={() => setDraft({ ...draft, source: 'key' })}
          />{' '}
          My API key
        </label>
      </fieldset>
      {draft.source === 'key' && (
        <>
          <p>
            Provider: <strong>OpenRouter</strong>
          </p>
          <label htmlFor="gallery-api-key">API key</label>
          <input
            autoComplete="off"
            spellCheck={false}
            id="gallery-api-key"
            type="password"
            value={draft.key}
            onChange={event => setDraft({ ...draft, key: event.target.value })}
          />
          <p className="gallery-settings-note">
            Saved in this browser’s local storage, including after closing the tab. Requests go
            directly to your endpoint and use your provider credits.
          </p>
          <details>
            <summary>Advanced</summary>
            <label htmlFor="gallery-inference-model">Model ID</label>
            <input
              id="gallery-inference-model"
              value={draft.model}
              spellCheck={false}
              onChange={event => setDraft({ ...draft, model: event.target.value })}
            />
            <label htmlFor="gallery-inference-endpoint">Chat-completions endpoint</label>
            <input
              id="gallery-inference-endpoint"
              type="url"
              value={draft.endpoint}
              spellCheck={false}
              onChange={event => setDraft({ ...draft, endpoint: event.target.value })}
            />
            <p>
              Use an OpenAI-compatible endpoint with JSON schema output and browser access (CORS).
              Your key and transcript go to this URL.
            </p>
          </details>
        </>
      )}
      <p>Saving pauses notes. Choose Start notes in the demo to resume.</p>
      {error && <p role="alert">{error}</p>}
      <div className="gallery-settings-actions">
        <Button type="submit">Save</Button>
        {session.settings.key && (
          <Button type="button" variant="ghost" onClick={() => apply(session.owner.remove)}>
            Remove key
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={close}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

/** Compact shared setup; listening/testing and model admission stay in the active view. */
export const GallerySpeechControls = (_props: { renderModelSelect?: GalleryModelSelect }) => {
  const measureInput: RefCallback<HTMLElement> = useCallback(node => {
    const gallery = node?.closest('.katakit-gallery');
    if (!node || !(gallery instanceof HTMLElement)) return;
    const measure = () => {
      gallery.style.setProperty(
        '--gallery-input-height',
        `${node.getBoundingClientRect().height}px`
      );
      gallery.style.setProperty(
        '--gallery-sidebar-height',
        `${window.innerHeight - Math.max(0, gallery.getBoundingClientRect().top)}px`
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      gallery.style.removeProperty('--gallery-input-height');
      gallery.style.removeProperty('--gallery-sidebar-height');
    };
  }, []);
  const session = useGallerySpeech();
  const inference = useGalleryInference();
  const {
    hostAvailable,
    settingsOpen: open = false,
    setSettingsOpen,
  } = useContext(GalleryModelContext);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  const close = () => {
    dialog.current?.close();
    setSettingsOpen?.(false);
  };
  const snapshot = session?.snapshot;
  const loading = snapshot?.input.phase === 'loading';
  const ready =
    snapshot && ['ready', 'running', 'starting', 'stopping'].includes(snapshot.input.phase);
  return (
    <section ref={measureInput} className="gallery-speech-controls" aria-label="Operation settings">
      <div className="gallery-operation-row">
        <span>Transcription</span>
        {ready ? (
          <span role="status">Ready · local</span>
        ) : (
          <button
            type="button"
            disabled={!session || snapshot?.blocked || (!loading && snapshot?.transitioning)}
            onClick={() => void (loading ? session?.owner.cancel() : session?.owner.load())}
          >
            {loading
              ? `Cancel ${snapshot?.input.phase === 'loading' && snapshot.input.progress !== undefined ? `${Math.round(snapshot.input.progress * 100)}%` : 'download'}`
              : 'Download model'}
          </button>
        )}
      </div>
      <div className="gallery-operation-row">
        <span>Inference</span>
        <button
          type="button"
          disabled={!inference}
          aria-haspopup="dialog"
          onClick={() => {
            setSettingsOpen?.(true);
          }}
        >
          {inference?.settings.source === 'key'
            ? 'My key'
            : hostAvailable
              ? 'Free demo'
              : 'Add API key'}{' '}
          ▾
        </button>
      </div>
      {(snapshot?.error || snapshot?.input.error) && (
        <p role="alert">{snapshot.error ?? snapshot.input.error?.message}</p>
      )}
      <dialog
        ref={dialog}
        className="gallery-inference-dialog"
        aria-label="Inference settings"
        onCancel={event => {
          event.preventDefault();
          close();
        }}
        onClose={() => {
          setSettingsOpen?.(false);
        }}
      >
        {open && inference && <InferenceSettings close={close} />}
      </dialog>
    </section>
  );
};

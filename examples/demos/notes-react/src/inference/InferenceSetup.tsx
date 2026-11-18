import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  signInResultParameter,
  type InferenceStatus,
  type InferenceUsage,
  type SignInResult,
} from './inferenceStatus';
import {
  InferenceRequestError,
  localInference,
  type InferenceUpdate,
  type LocalInference,
} from './localInference';
import './inferenceSetup.css';

const signInMessages: Record<SignInResult, string> = {
  connected: 'Signed in with OpenRouter. Your key is saved.',
  no_credits:
    'Signed in with OpenRouter, but the account has no credits. Add credits at openrouter.ai/settings/credits, then listen again.',
  cancelled: 'OpenRouter sign-in was cancelled.',
  failed: 'OpenRouter sign-in did not finish. Try again, or paste a key.',
};

/** A non-zero cost below a hundredth of a cent still reads as spent, not free. */
const formatCost = (cost: number) =>
  cost > 0 && cost < 0.0001 ? '<$0.0001' : `$${cost.toFixed(4)}`;

export const formatUsage = (usage: InferenceUsage) => {
  const tokens = `${(usage.inputTokens + usage.outputTokens).toLocaleString()} tokens`;
  return usage.cost === undefined ? tokens : `${tokens} · ${formatCost(usage.cost)}`;
};

/**
 * Set up, inspect, and change the dev server's model connection without leaving the demo.
 * With a working connection it is one line; **Change** opens the details.
 */
export const InferenceSetup = ({ local }: { local: LocalInference }) => {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<InferenceRequestError>();
  const { notice, setNotice } = local;

  // The sign-in callback returns here with its result in the URL; show it once, then remove it.
  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get(signInResultParameter) as SignInResult | null;
    if (!result || !(result in signInMessages)) return;
    setNotice(signInMessages[result]);
    url.searchParams.delete(signInResultParameter);
    window.history.replaceState(window.history.state, '', url);
  }, [setNotice]);

  const run = async (action: () => Promise<InferenceUpdate>, success: string) => {
    setBusy(true);
    setError(undefined);
    setNotice('');
    try {
      const result = await action();
      local.update(result.status, result.notice ?? success);
      return true;
    } catch (error_) {
      setError(
        error_ instanceof InferenceRequestError
          ? error_
          : new InferenceRequestError('unavailable', 'The dev server is not responding.')
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (local.state.type === 'loading')
    return <p className="katakit-inference-status">Checking model setup…</p>;
  if (local.state.type === 'unavailable')
    return (
      <p className="katakit-inference-status">
        Model setup needs the dev server. Run <code>pnpm dev</code> and open the URL it prints.
      </p>
    );
  const { status } = local.state;
  const connection = status.connection;
  const messages = (
    <>
      {error && <p role="alert">{error.message}</p>}
      {notice && <p role="status">{notice}</p>}
    </>
  );

  if (connection && !expanded)
    return (
      <section className="katakit-inference" aria-label="Model setup">
        <p className="katakit-inference-summary">
          <span>
            {connection.providerName} · <code>{connection.model}</code> · {sourceLabel(status)}
            {status.usage.requests > 0 && <> · {formatUsage(status.usage)}</>}
          </span>
          <button type="button" onClick={() => setExpanded(true)}>
            Change
          </button>
        </p>
        {messages}
      </section>
    );

  return (
    <section className="katakit-inference" aria-label="Model setup">
      {connection ? (
        <ConnectionDetails
          status={{ ...status, connection }}
          busy={busy}
          run={run}
          onDone={() => {
            setExpanded(false);
            setError(undefined);
          }}
        />
      ) : (
        <ConnectForm status={status} busy={busy} error={error} run={run} />
      )}
      {messages}
    </section>
  );
};

const sourceLabel = ({ connection }: InferenceStatus) =>
  !connection
    ? ''
    : connection.source === 'environment'
      ? connection.variable
      : connection.keyHint
        ? `saved key …${connection.keyHint}`
        : 'saved connection';

type Run = (action: () => Promise<InferenceUpdate>, success: string) => Promise<boolean>;

/** First-run setup: paste a key, sign in with OpenRouter, use Ollama, or a custom endpoint. */
const ConnectForm = ({
  status,
  busy,
  error,
  run,
}: {
  status: InferenceStatus;
  busy: boolean;
  error?: InferenceRequestError;
  run: Run;
}) => {
  const id = useId();
  const [key, setKey] = useState('');
  const [provider, setProvider] = useState('');
  const [ollamaModel, setOllamaModel] = useState(status.ollamaModels?.[0] ?? '');
  const [custom, setCustom] = useState({ endpoint: '', model: '', key: '' });
  const choosingProvider = error?.code === 'provider_unknown' || !!provider;
  const connectKey = async (event: FormEvent) => {
    event.preventDefault();
    const saved = await run(
      () => localInference.saveKey({ key, ...(provider ? { provider } : {}) }),
      'Connected. Notes start when you listen.'
    );
    if (saved) setKey('');
  };
  return (
    <>
      <h3>Set up a model</h3>
      <p>
        Paste an API key from OpenRouter, Anthropic, OpenAI, Google, or Groq. The dev server checks
        it with one small request and saves it in your user settings, outside this folder. The
        browser never receives it.
      </p>
      <form className="katakit-inference-row" onSubmit={connectKey}>
        <label htmlFor={`${id}-key`}>
          API key
          <input
            id={`${id}-key`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={key}
            onChange={event => setKey(event.target.value)}
          />
        </label>
        {choosingProvider && (
          <label htmlFor={`${id}-provider`}>
            Provider
            <select
              id={`${id}-provider`}
              value={provider}
              onChange={event => setProvider(event.target.value)}
            >
              <option value="">Choose…</option>
              {status.providers.map(option => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" disabled={busy || !key.trim() || (choosingProvider && !provider)}>
          {busy ? 'Checking…' : 'Connect'}
        </button>
      </form>
      <p className="katakit-inference-row">
        <a className="katakit-inference-button" href={localInference.signInUrl(location.pathname)}>
          Sign in with OpenRouter
        </a>
        <span>Creates a key limited to $5 for 30 days. Signing in leaves this page.</span>
      </p>
      {status.ollamaModels && (
        <form
          className="katakit-inference-row"
          onSubmit={event => {
            event.preventDefault();
            void run(
              () => localInference.saveKey({ provider: 'ollama', model: ollamaModel }),
              'Connected to Ollama.'
            );
          }}
        >
          <label htmlFor={`${id}-ollama`}>
            Local Ollama model
            <select
              id={`${id}-ollama`}
              value={ollamaModel}
              onChange={event => setOllamaModel(event.target.value)}
            >
              {status.ollamaModels.map(model => (
                <option key={model}>{model}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy}>
            Use Ollama
          </button>
        </form>
      )}
      <details>
        <summary>Custom endpoint</summary>
        <form
          className="katakit-inference-row"
          onSubmit={event => {
            event.preventDefault();
            void run(
              () =>
                localInference.saveKey({
                  provider: 'custom',
                  endpoint: custom.endpoint,
                  model: custom.model,
                  ...(custom.key ? { key: custom.key } : {}),
                }),
              'Connected to your endpoint.'
            );
          }}
        >
          <label htmlFor={`${id}-endpoint`}>
            Chat-completions URL
            <input
              id={`${id}-endpoint`}
              type="url"
              spellCheck={false}
              placeholder="http://127.0.0.1:1234/v1/chat/completions"
              value={custom.endpoint}
              onChange={event => setCustom({ ...custom, endpoint: event.target.value })}
            />
          </label>
          <label htmlFor={`${id}-custom-model`}>
            Model
            <input
              id={`${id}-custom-model`}
              spellCheck={false}
              value={custom.model}
              onChange={event => setCustom({ ...custom, model: event.target.value })}
            />
          </label>
          <label htmlFor={`${id}-custom-key`}>
            Key (optional)
            <input
              id={`${id}-custom-key`}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={custom.key}
              onChange={event => setCustom({ ...custom, key: event.target.value })}
            />
          </label>
          <button type="submit" disabled={busy || !custom.endpoint || !custom.model}>
            Connect
          </button>
        </form>
        <p>The endpoint must support JSON schema output.</p>
      </details>
      <p className="katakit-inference-hint">
        Already have a key in your shell? Export one of{' '}
        {status.environmentVariables.map((variable, index) => (
          <span key={variable}>
            {index > 0 && ', '}
            <code>{variable}</code>
          </span>
        ))}{' '}
        and restart <code>pnpm dev</code>.
      </p>
    </>
  );
};

/** The working connection: model override, usage, and removing a saved key. */
const ConnectionDetails = ({
  status,
  busy,
  run,
  onDone,
}: {
  status: InferenceStatus & { connection: NonNullable<InferenceStatus['connection']> };
  busy: boolean;
  run: Run;
  onDone: () => void;
}) => {
  const id = useId();
  const { connection, usage } = status;
  const [model, setModel] = useState(connection.model);
  const [upstream, setUpstream] = useState(connection.upstream ?? '');
  const [replacing, setReplacing] = useState(false);
  if (replacing)
    return (
      <>
        <ConnectForm status={status} busy={busy} run={run} />
        <button type="button" onClick={() => setReplacing(false)}>
          Keep the current connection
        </button>
      </>
    );
  return (
    <>
      <h3>Model setup</h3>
      <dl className="katakit-inference-facts">
        <dt>Provider</dt>
        <dd>
          {connection.providerName}
          {connection.endpointHost && ` (${connection.endpointHost})`}
        </dd>
        <dt>Credential</dt>
        <dd>{sourceLabel(status)}</dd>
        <dt>Usage</dt>
        <dd>
          {usage.requests} {usage.requests === 1 ? 'request' : 'requests'} ·{' '}
          {usage.inputTokens.toLocaleString()} in · {usage.outputTokens.toLocaleString()} out
          {usage.cost !== undefined && ` · ${formatCost(usage.cost)}`} since the dev server started
        </dd>
      </dl>
      <form
        className="katakit-inference-row"
        onSubmit={event => {
          event.preventDefault();
          void run(
            () => localInference.saveModel({ model, ...(upstream ? { upstream } : {}) }),
            `Using ${model}.`
          );
        }}
      >
        <label htmlFor={`${id}-model`}>
          Model
          <input
            id={`${id}-model`}
            spellCheck={false}
            value={model}
            onChange={event => setModel(event.target.value)}
          />
        </label>
        {connection.provider === 'openrouter' && (
          <label htmlFor={`${id}-upstream`}>
            Upstream provider (optional)
            <input
              id={`${id}-upstream`}
              spellCheck={false}
              placeholder="e.g. anthropic"
              value={upstream}
              onChange={event => setUpstream(event.target.value)}
            />
          </label>
        )}
        <button
          type="submit"
          disabled={
            busy ||
            !model.trim() ||
            (model === connection.model && upstream === (connection.upstream ?? ''))
          }
        >
          {busy ? 'Checking…' : 'Save model'}
        </button>
        {connection.defaultModel && connection.model !== connection.defaultModel && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              const saved = await run(
                () => localInference.saveModel({}),
                `Using the default, ${connection.defaultModel}.`
              );
              if (!saved) return;
              setModel(connection.defaultModel!);
              setUpstream('');
            }}
          >
            Reset to {connection.defaultModel}
          </button>
        )}
      </form>
      <p className="katakit-inference-row">
        <button type="button" disabled={busy} onClick={() => setReplacing(true)}>
          Use a different key
        </button>
        {connection.source === 'saved' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(localInference.removeKey, 'Saved key removed.')}
          >
            Remove saved key
          </button>
        ) : (
          <span>
            To stop using <code>{connection.variable}</code>, unset it and restart{' '}
            <code>pnpm dev</code>.
          </span>
        )}
        <button
          type="button"
          disabled={busy || usage.requests === 0}
          onClick={() => void run(localInference.resetUsage, 'Usage reset.')}
        >
          Reset usage
        </button>
        <button type="button" onClick={onDone}>
          Done
        </button>
      </p>
    </>
  );
};

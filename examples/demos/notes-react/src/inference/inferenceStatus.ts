/**
 * The contract between this demo's dev-server model connection (`inference/`) and the browser.
 * Responses never contain a key: the browser sees only a provider, a model, and a key hint.
 */
export const inferenceRoute = '/__katakit/inference';

export type InferenceProviderId =
  | 'openrouter'
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'groq'
  | 'ollama'
  | 'custom';

/** Running totals for this dev server process. Providers that report no cost leave it unset. */
export type InferenceUsage = {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cost?: number;
};

export type InferenceConnectionStatus = {
  provider: InferenceProviderId;
  providerName: string;
  /** `saved` is a key in the user's settings file; `environment` is a provider variable. */
  source: 'saved' | 'environment';
  /** The variable that supplied the key when `source` is `environment`. */
  variable?: string;
  /** The last four characters of the key, when there is one. */
  keyHint?: string;
  model: string;
  /** The provider's default model; absent for Ollama and custom endpoints. */
  defaultModel?: string;
  /** OpenRouter only: the upstream provider slug requests are routed to first. */
  upstream?: string;
  /** Custom endpoints only: the host requests go to. */
  endpointHost?: string;
  /** Present when the provider offers a typed decision model (OpenRouter). */
  decisions?: { model: string; maxQuestions: number };
};

export type InferenceStatus = {
  connection?: InferenceConnectionStatus;
  usage: InferenceUsage;
  /** Providers a pasted key can belong to, for the picker shown when a key is unrecognized. */
  providers: { id: InferenceProviderId; name: string; defaultModel?: string }[];
  /** Models a local Ollama reports, probed only while no connection is set up. */
  ollamaModels?: string[];
  /** Environment variables the dev server checks, in order. */
  environmentVariables: string[];
};

/** Error body every inference route returns; `message` is safe to show and holds no key. */
export type InferenceError = {
  error: {
    code:
      | 'bad_request'
      | 'forbidden'
      | 'provider_unknown'
      | 'not_inference_key'
      | 'no_connection'
      | 'decisions_unavailable'
      | 'key_rejected'
      | 'no_credits'
      | 'model_unavailable'
      | 'structured_output_unsupported'
      | 'rate_limited'
      | 'response_unreadable'
      | 'unreachable'
      | 'upstream_failed';
    message: string;
  };
};

/** Query parameter the OpenRouter sign-in callback adds when it returns to the demo. */
export const signInResultParameter = 'katakit-inference';
export type SignInResult = 'connected' | 'no_credits' | 'cancelled' | 'failed';

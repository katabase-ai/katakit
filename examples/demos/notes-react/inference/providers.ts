import type {
  InferenceError,
  InferenceProviderId,
  InferenceUsage,
} from '../src/inference/inferenceStatus';

/**
 * One row per provider a developer's key can belong to. Every default must support strict JSON
 * schema output and cost no more than Claude Sonnet 5.5 per input or output token. Production
 * notes use `z-ai/glm-5.3` with `anthropic/claude-sonnet-5.5` as the fallback, so a default should
 * produce notes of that quality. Run `pnpm check:models` before changing a default.
 */
export type InferenceProvider = {
  id: InferenceProviderId;
  name: string;
  /** Recognizes a pasted key. Ollama and custom endpoints are chosen, never detected. */
  keyPattern?: RegExp;
  /** Variables the dev server reads, in order. */
  environment: readonly string[];
  /** OpenAI-compatible base URL; requests go to `${baseUrl}/chat/completions`. */
  baseUrl?: string;
  defaultModel?: string;
  /** OpenRouter only: the model it routes to when the default is unavailable. */
  fallbackModel?: string;
  /** Where to buy credits, linked from the no-credits message. */
  creditsUrl?: string;
};

export const inferenceProviders = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    keyPattern: /^sk-or-v1-/,
    environment: ['OPENROUTER_API_KEY'],
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'z-ai/glm-5.3',
    fallbackModel: 'anthropic/claude-sonnet-5.5',
    creditsUrl: 'https://openrouter.ai/settings/credits',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    keyPattern: /^sk-ant-api\d\d-/,
    environment: ['ANTHROPIC_API_KEY'],
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-5-5',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    // Every OpenAI key format embeds base64("OpenAI"), which separates it from other `sk-` keys.
    keyPattern: /T3BlbkFJ/,
    environment: ['OPENAI_API_KEY'],
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-6.2-sol',
  },
  {
    id: 'google',
    name: 'Google',
    keyPattern: /^(AIza[\w-]{35}|AQ\.[\w.-]+)$/,
    environment: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-4-hydrogen',
  },
  {
    id: 'groq',
    name: 'Groq',
    keyPattern: /^gsk_/,
    environment: ['GROQ_API_KEY'],
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-120b',
  },
  { id: 'ollama', name: 'Ollama', environment: [], baseUrl: 'http://127.0.0.1:11434/v1' },
  { id: 'custom', name: 'Custom endpoint', environment: [] },
] as const satisfies readonly InferenceProvider[];

export const getInferenceProvider = (id: InferenceProviderId): InferenceProvider =>
  inferenceProviders.find(provider => provider.id === id)!;

/** Providers whose key can come from the environment, in lookup order. */
export const environmentProviders: readonly InferenceProvider[] = inferenceProviders.filter(
  provider => provider.environment.length > 0
);

/**
 * Name the provider a pasted key belongs to. Admin keys and OAuth tokens are refused because
 * they cannot run inference; an unrecognized key returns `undefined` so the developer chooses.
 */
export const detectInferenceProvider = (key: string) => {
  if (/^sk-ant-(admin|oat)/.test(key)) return 'notInference' as const;
  return environmentProviders.find(provider => provider.keyPattern?.test(key))?.id;
};

/**
 * Adapt the demo's request body for one provider. Demos build one OpenRouter-style body; each
 * provider rejects or ignores a different part of it.
 */
export const prepareInferenceRequest = ({
  provider,
  model,
  upstream,
  body,
  allowFallback,
}: {
  provider: InferenceProvider;
  model: string;
  upstream?: string;
  body: Record<string, unknown>;
  /** A connection check proves one model, so it never falls back. */
  allowFallback: boolean;
}) => {
  const { reasoning, temperature, top_p, ...rest } = body;
  const prepared: Record<string, unknown> = { ...rest, model };
  switch (provider.id) {
    case 'openrouter':
      prepared.reasoning = reasoning;
      prepared.temperature = temperature;
      prepared.top_p = top_p;
      prepared.usage = { include: true };
      prepared.provider = {
        require_parameters: true,
        ...(upstream ? { order: [upstream] } : {}),
      };
      if (allowFallback && model === provider.defaultModel && provider.fallbackModel)
        prepared.models = [model, provider.fallbackModel];
      break;
    case 'anthropic':
      // The compatibility endpoint ignores reasoning effort and rejects non-default sampling.
      break;
    case 'openai':
    case 'google':
    case 'groq':
      prepared.temperature = temperature;
      prepared.top_p = top_p;
      if (reasoning) prepared.reasoning_effort = 'low';
      break;
    case 'ollama':
      prepared.temperature = temperature;
      prepared.top_p = top_p;
      break;
    case 'custom':
      // The developer chose this endpoint; send the demo's body unchanged.
      return { ...body, model };
  }
  for (const [key, value] of Object.entries(prepared))
    if (value === undefined) delete prepared[key];
  return prepared;
};

/** Read token counts and, when the provider reports it, the cost of one completion. */
export const readCompletionUsage = (completion: unknown): InferenceUsage => {
  const usage =
    typeof completion === 'object' && completion !== null && 'usage' in completion
      ? (completion.usage as Record<string, unknown> | null)
      : undefined;
  const count = (value: unknown) => (typeof value === 'number' && value >= 0 ? value : 0);
  return {
    requests: 1,
    inputTokens: count(usage?.prompt_tokens),
    outputTokens: count(usage?.completion_tokens),
    ...(typeof usage?.cost === 'number' ? { cost: usage.cost } : {}),
  };
};

export const addInferenceUsage = (total: InferenceUsage, next: InferenceUsage) => ({
  requests: total.requests + next.requests,
  inputTokens: total.inputTokens + next.inputTokens,
  outputTokens: total.outputTokens + next.outputTokens,
  ...(total.cost !== undefined || next.cost !== undefined
    ? { cost: (total.cost ?? 0) + (next.cost ?? 0) }
    : {}),
});

/**
 * Explain a failed upstream response without repeating its body, which can echo the key or the
 * transcript. The text is only inspected to tell structured-output and model failures apart.
 */
export const describeUpstreamFailure = ({
  provider,
  model,
  status,
  text,
}: {
  provider: InferenceProvider;
  model: string;
  status: number;
  text: string;
}): InferenceError['error'] => {
  if (status === 401 || status === 403)
    return {
      code: 'key_rejected',
      message: `${provider.name} rejected the key. Check it, or connect a different one.`,
    };
  if (status === 402)
    return {
      code: 'no_credits',
      message: `Your ${provider.name} account has no credits.${provider.creditsUrl ? ` Add credits at ${provider.creditsUrl}.` : ''}`,
    };
  if (status === 429)
    return {
      code: 'rate_limited',
      message: `${provider.name} is rate limiting requests. Wait a moment, then try again.`,
    };
  if (status === 400 && /response_format|json_schema|structured/i.test(text))
    return {
      code: 'structured_output_unsupported',
      message: `${model} does not support structured output. Choose another model.`,
    };
  if (status === 404 || (status === 400 && /model/i.test(text)))
    return {
      code: 'model_unavailable',
      message: `${model} is not available for this key.${provider.defaultModel && provider.defaultModel !== model ? ` Try the default, ${provider.defaultModel}.` : ''}`,
    };
  return {
    code: 'upstream_failed',
    message: `${provider.name} could not complete the request (HTTP ${status}). Try again.`,
  };
};

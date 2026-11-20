import { expect, test } from 'vitest';
import {
  describeUpstreamFailure,
  detectInferenceProvider,
  getInferenceProvider,
  prepareInferenceRequest,
} from './providers';

// Fixture keys are joined from parts so secret scanners do not mistake them for real keys.
const fakeKey = (...parts: string[]) => parts.join('');

test.each([
  [fakeKey('sk-or-', 'v1-', '0'.repeat(64)), 'openrouter'],
  [fakeKey('sk-ant-', 'api03-', 'abc'), 'anthropic'],
  [fakeKey('sk-proj-', 'abc', 'T3Blbk', 'FJdef'), 'openai'],
  [fakeKey('sk-', 'abc', 'T3Blbk', 'FJdef'), 'openai'],
  [fakeKey('AI', 'za', 'x'.repeat(35)), 'google'],
  [fakeKey('AQ.', 'Ab8RN6abc'), 'google'],
  [fakeKey('gsk', '_abc'), 'groq'],
  [fakeKey('sk-ant-', 'oat01-', 'abc'), 'notInference'],
  ['sk-0123456789abcdef', undefined],
])('%s is detected as %s', (key, provider) => {
  expect(detectInferenceProvider(key)).toBe(provider);
});

const demoBody = {
  model: 'z-ai/glm-5.3',
  reasoning: { effort: 'low' },
  temperature: 0.2,
  messages: [],
};

test('Anthropic drops reasoning effort and sampling its compatibility endpoint rejects', () => {
  expect(
    prepareInferenceRequest({
      provider: getInferenceProvider('anthropic'),
      model: 'claude-sonnet-5-5',
      body: demoBody,
      allowFallback: true,
    })
  ).toEqual({ model: 'claude-sonnet-5-5', messages: [] });
});

test('an overridden OpenRouter model has no fallback and can name an upstream provider', () => {
  expect(
    prepareInferenceRequest({
      provider: getInferenceProvider('openrouter'),
      model: 'openai/gpt-6.2-sol',
      upstream: 'openai',
      body: demoBody,
      allowFallback: true,
    })
  ).toMatchObject({
    model: 'openai/gpt-6.2-sol',
    provider: { require_parameters: true, order: ['openai'] },
  });
});

test('a structured-output refusal is told apart from an unknown model', () => {
  const provider = getInferenceProvider('groq');
  expect(
    describeUpstreamFailure({
      provider,
      model: 'm',
      status: 400,
      text: 'model m does not support response_format json_schema',
    }).code
  ).toBe('structured_output_unsupported');
  expect(
    describeUpstreamFailure({ provider, model: 'm', status: 400, text: 'model m not found' }).code
  ).toBe('model_unavailable');
});

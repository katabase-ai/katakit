# Dev-server model connection

This directory is a Vite plugin that gives the demo a model connection while `pnpm dev` runs.
`src/inference/` holds the browser client (`localInference.ts`) and the setup panel
(`InferenceSetup.tsx`). Both directories are the canonical copy: another demo that calls a model
copies them, and the gallery imports them from here.

- `inferencePlugin.ts` registers the routes and prints the startup line.
- `inferenceHandler.ts` resolves the credential, checks keys and models before saving, forwards
  requests, keeps usage totals, and runs OpenRouter sign-in.
- `providers.ts` is the provider table: key patterns, environment variables, base URLs, defaults,
  and the request adjustments each provider needs.
- `savedInference.ts` reads and writes the saved key outside the demo folder.
- `checkDefaultModels.mjs` (`pnpm check:models`) sends the real notes request to each default.

Routes under `/__katakit/inference/`:

| Route                      | Purpose                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| `GET /status`              | Provider, model, credential source, key hint, usage. No key.     |
| `POST /key`                | Detect, check, and save a pasted key, Ollama model, or endpoint. |
| `DELETE /key`              | Remove the saved key.                                            |
| `PUT /model`               | Check and save a model override, or clear it.                    |
| `DELETE /usage`            | Reset usage totals.                                              |
| `POST /chat/completions`   | Forward a demo's request to the selected provider.               |
| `GET /openrouter/start`    | Begin OpenRouter sign-in (PKCE).                                 |
| `GET /openrouter/callback` | Finish sign-in, save the key, return to the demo.                |

A route that adds a key to requests would let any web page spend it. Every route except the
sign-in callback answers only same-origin requests from this machine: the `Host` must be a loopback
name, the client a loopback address, and `Origin`/`Sec-Fetch-Site` this page. The callback is
protected by its single-use `state` and PKCE verifier instead.

Demos build one OpenRouter-style request body. `prepareInferenceRequest` adapts it per provider:
OpenRouter keeps `reasoning` and gets `require_parameters` and a fallback model; OpenAI, Google,
and Groq get `reasoning_effort: 'low'`; Anthropic drops reasoning and sampling settings its
compatibility endpoint rejects. Errors shown to the demo never include the key or the provider's
response body.

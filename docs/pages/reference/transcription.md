# Transcription utilities

`@katakit/transcription` is a standalone utility package for Moonshine and Whisper recognition.
It has no React, RxJS, or plugin-system dependency. Applications own the UI and receive
plain result, status, progress, and audio-level callbacks. The [transcript ingestion plugin](plugins/transcript-ingestion.md)
optionally groups its finalized results into conversation turns.

## Setup

Install `@katakit/transcription`. Provider runtime files are included; applications do not need to
install SDKs or write worker/worklet entries. With Vite, configure assets once:

```ts
import { defineConfig } from 'vite';
import { transcriptionAssetsPlugin } from '@katakit/transcription/vite';
export default defineConfig({ plugins: [transcriptionAssetsPlugin()] });
```

This serves `/transcription-assets/` during development and copies the files into production
output. It preserves Moonshine's JavaScript/WASM/pthread sibling layout, bundles the
Whisper module worker, supplies ONNX WASM files, and includes the capture AudioWorklet.
Development and preview receive COOP/COEP headers. Production hosting must set those headers
for Moonshine's default threaded SDK. Whisper uses one inference thread and does not itself
require cross-origin isolation. Both use local inference; model weights download from their
providers on first use and use provider caches. Model weights are not shipped in the package.

For another toolchain, call `copyTranscriptionAssets('./public/transcription-assets')` from
`@katakit/transcription/assets` in your build. Serve JavaScript and WASM with their correct MIME types.
`assetsBaseUrl` defaults to `/transcription-assets/`; for a Vite subdirectory deployment, pass
`${import.meta.env.BASE_URL}transcription-assets/`. A custom `transcriptionAssetsPlugin({ assetsPath })`
requires a matching runtime URL.

## Microphone API

The same API works in React and non-React browser applications. Call `start()` from a user
action. Capture requires HTTPS or localhost, permission, and AudioWorklet support.

```ts
import { createMicrophoneTranscriber } from '@katakit/transcription/browser';
const input = createMicrophoneTranscriber({
  model: 'moonshine-small',
  onState: state => console.log(state.phase, state.progress, state.error?.message),
  onLevel: level => console.log(level),
  onProvisional: text => console.log('preview', text),
  onFinal: segment => console.log('final', segment),
  onStop: () => console.log('session ended'),
});
await input.start();
// Later:
await input.stop();
await input.dispose();
```

`load()` optionally preloads without microphone permission. `start({ sourceId? })` starts a
session, generating an ID when omitted. `stop()` delivers the last capture buffer and drains
recognition before `onStop`; the model stays loaded for reuse. `dispose()` waits for pending
startup, releases resources, suppresses late results, and is idempotent and terminal. Call
`stop()` first when every final result is needed. Catch rejected lifecycle calls in UI
handlers; asynchronous failures are also reported through `onState` as a `TranscriptionError` with
`code`, `message`, and optional `cause`. Missing isolation and unsupported APIs produce
actionable errors before model loading.

The `transcriptionModels` catalog exposes `id`, `label`, `language`, and `provisional`. Initial
models are English Moonshine Tiny, Small, and Medium Streaming (`moonshine-tiny`,
`moonshine-small`, `moonshine-medium`) and quantized Whisper Tiny English (`whisper-tiny`).
Moonshine provides interim and final text. Whisper returns finalized ten-second chunks,
including the partial tail on stop, with chunk-boundary timestamps and no live preview.

Final `TranscriptionSegment` values contain `{ sourceId, id, text, startMs?, endMs? }`. IDs are opaque
and distinct within a source; timestamps are milliseconds relative to the session.
`onLevel` reports approximate activity in [0, 1] roughly ten times per second.

## PCM and host boundaries

`createBrowserTranscriber` from the browser entry provides the same engines without capture.
After `start()`, feed mono floats through `write(samples, sampleRate)`; Whisper requires
16 kHz. The base `createTranscriber({ engine, ...callbacks })` accepts an injected
`TranscriptionEngine` and has no browser or UI dependency. Advanced `moonshine` and `whisper`
factories support custom SDK loading and worker transports.

React is optional. Electron renderer use depends on browser APIs, asset loading, permissions,
and isolation; no Electron-specific recipe has been verified. Node/Electron main use
requires an injected compatible engine; there is no built-in Node model adapter or microphone
capture. Obsidian desktop/mobile have no verified recipe. Browser extensions retain their
own capture and permission lifecycle; the existing extension demo uses the standalone PCM
engine in its worker. A compatible application name alone does not establish runtime support.

To connect to a running [transcript ingestion plugin](plugins/transcript-ingestion.md), pass
`onFinal: methods.ingestSegment`, `onProvisional: methods.updateProvisional`, and
`onStop: methods.flush`. Other applications can send the same results to their own state or storage.

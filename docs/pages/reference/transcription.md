# Transcription utilities

`@katakit/transcription` provides Moonshine and Whisper recognition independently of React,
RxJS, and the Katakit plugin system. React applications can use the optional
`useMicrophoneTranscriber` hook from `@katakit/transcription/react`. Browser applications can use its microphone helper;
applications with their own PCM source can use `createBrowserTranscriber` or supply an engine
to the base `createTranscriber` API. The [transcript ingestion plugin](plugins/transcript-ingestion.md)
can optionally group final segments into turns.

## Browser quick start

Install `@katakit/transcription`. With Vite, serve and copy its packaged runtime assets:

```ts
import { defineConfig } from 'vite';
import { transcriptionAssetsPlugin } from '@katakit/transcription/vite';

export default defineConfig({ plugins: [transcriptionAssetsPlugin({ isolate: true })] });
```

`isolate: true` sets COOP/COEP headers in development and preview for Moonshine. Omit it
for Whisper-only applications or when your host configures those headers itself. Production
Moonshine hosting must also set COOP/COEP; model weights are downloaded on first use.

```ts
import { createMicrophoneTranscriber } from '@katakit/transcription/browser';

const input = createMicrophoneTranscriber({
  model: 'moonshine-small',
  onFinal: segment => console.log(segment),
});
await input.start(); // From a user action.
// Later: await input.stop(); await input.dispose();
```

## Configuration and output

- `model` selects a recognizer; the default is `moonshine-small`. `moonshine-tiny` and `moonshine-medium` also support streaming provisional results. `whisper-tiny` delivers final results from audio chunks.
- `assetsBaseUrl` locates the packaged worker and WASM assets; it defaults to `/transcription-assets/`.
- `onFinal(segment)` receives `{ id, sourceId, text, startMs?, endMs? }`. Times are milliseconds relative to the recognition session.
- `onProvisional(text)` receives mutable interim text where the model supports it. Keep this separate from finalized segments.
- `onState(state)` reports phase, optional loading progress, and errors. `onLevel(level)` reports microphone activity from 0 to 1.
- `onStop()` marks the end of a capture session after pending recognition has drained, including when recognition ends with an error.

## Lifecycle

Construction does not request microphone permission or download a model. `load()` optionally preloads the model. `start({ sourceId? })` loads as needed and starts a session; call it from a user action. If omitted, the source ID is generated for that session.

`stop()` closes capture and drains accepted recognition work, including remaining final results. It keeps the model loaded for another start. `dispose()` releases capture, model, and worker resources and is terminal. Call `stop()` before `dispose()` when you need final results. Awaited operations can reject; handle failures in the application's event handlers.

Moonshine's threaded runtime needs HTTPS or localhost and cross-origin isolation. The Vite helper sets development and preview headers, but production hosting must set them too. Whisper does not need cross-origin isolation. Model weights download on first use; recognition processes audio locally.

## React ownership

`useMicrophoneTranscriber({ createSink })` owns capture and the object receiving its results for a component's lifetime. Supply a stable factory returning `ingestSegment`, optional `updateProvisional` and `flush`, and `close`. On unmount the hook drains capture before closing that object. It exposes `sink`, `state`, `level`, `listening`, `busy`, and `toggle`.

This manages capture resources. Use [React-RxJS](../getting-started/react.md) separately for subscriptions to runtime observables. The [React template](../starters/react-web.md) shows a complete application.

See the [package guide](https://github.com/katabase-ai/katakit/blob/main/pkgs/transcription/README.md)
for model capabilities, PCM and custom-engine examples, lifecycle and error handling,
non-Vite asset setup, production hosting, and application support boundaries.

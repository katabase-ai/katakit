# @katakit/transcription

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

Moonshine runs WebAssembly on multiple threads and uses `SharedArrayBuffer` to share memory
between them. Browsers restrict shared memory to **cross-origin isolated** pages, which enforce
stricter rules for interacting with other sites. The page must also use HTTPS or localhost.

`isolate: true` enables this isolation in Vite's development and preview servers by adding two
HTTP response headers:

- **Cross-Origin-Opener-Policy (COOP)**: `Cross-Origin-Opener-Policy: same-origin` separates the
  page from windows opened on other origins. See [COOP on MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy).
- **Cross-Origin-Embedder-Policy (COEP)**: `Cross-Origin-Embedder-Policy: require-corp` requires
  resources loaded from other origins to permit that use through CORS or a Cross-Origin-Resource-Policy
  response header. Resources without that permission are blocked. See [COEP on MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy).

For production, configure your web server or hosting provider to send these headers too;
Vite's setting does not configure the deployed host. Check `window.crossOriginIsolated` in
the browser console on the running page: it should be `true` before starting Moonshine.
Whisper does not require cross-origin isolation. Omit `isolate: true` for Whisper-only applications
or when your host already supplies the headers.

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

Model weights download on first use; recognition processes audio locally.

## React ownership

`useMicrophoneTranscriber({ createSink?, model? })` owns capture for a component's lifetime.
When capture and its destination share that lifetime, supply a stable `createSink` returning
`ingestSegment`, optional `updateProvisional` and `flush`, and `close`. The hook keeps that
sink attached while unmount stops and drains capture, then disposes the transcriber and
closes the sink. It exposes `state`, `listening`, `busy`, `toggle`, and an `emitter` for
optional UI callbacks. `useMicrophoneTranscriberCallbacks` attaches callbacks to that
emitter for the mounted component's lifetime; those callbacks alone are not a reliable
destination for final segments delivered after the component unmounts.

This manages capture resources. Use [React-RxJS](react.md#react-rxjs-bindings) separately for subscriptions to runtime observables. The [React starter](../starters/react-web.md) shows a complete application.

See the [package guide](https://github.com/katabase-ai/katakit/blob/main/pkgs/transcription/README.md)
for model capabilities, PCM and custom-engine examples, lifecycle and error handling,
non-Vite asset setup, production hosting, and application support boundaries.

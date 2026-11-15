# Speech utilities

`@katakit/speech` supplies framework-independent speech recognition, browser microphone
capture, and the WASM/worker assets needed to run Moonshine and Whisper. It has no React,
RxJS, or plugin-system dependency. Applications own their UI and consume plain callbacks.
The base entry point has no runtime dependencies; importing it creates no microphone,
worker, or download. Browser engines are loaded explicitly through the browser entry point.

## Browser setup

Install `@katakit/speech`. The package includes the runtime JavaScript and WASM files;
you do not need to install provider SDKs or author worker/worklet scripts.

With Vite, add the asset helper once:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { speechAssetsPlugin } from '@katakit/speech/vite';

export default defineConfig({ plugins: [speechAssetsPlugin()] });
```

The helper serves `/speech-assets/` in development, copies files to that directory in the
build output, and configures COOP/COEP headers for development and preview. It preserves
Moonshine's SDK/WASM/pthread sibling layout and supplies a bundled Whisper module worker,
ONNX WASM files, and the microphone AudioWorklet. Runtime files are loaded on demand;
model weights download from their providers on first use, using the providers' caches.
Audio is processed locally. Model weights are not included in the package, and first use
requires network access.

For another bundler or static server, copy the same packaged assets during your build:

```js
import { copySpeechAssets } from '@katakit/speech/assets';
await copySpeechAssets('./public/speech-assets');
```

Serve JavaScript as `text/javascript` and WASM as `application/wasm`. Configure production
hosting yourself: Moonshine's default threaded SDK needs HTTPS (or localhost),
`Cross-Origin-Opener-Policy: same-origin`, and `Cross-Origin-Embedder-Policy: require-corp`.
Whisper uses one inference thread and does not require cross-origin isolation. A host's
CSP must allow the selected runtime's workers, WASM execution, and model-provider requests.
The utility reports unsupported environments and missing isolation before model loading.

`assetsBaseUrl` defaults to `/speech-assets/`. For deployment under a Vite subdirectory,
pass `${import.meta.env.BASE_URL}speech-assets/`. To customize the directory, configure
`speechAssetsPlugin({ assetsPath: 'runtime/speech' })` and pass the corresponding
`assetsBaseUrl`. Asset hosting is the only provider-independent build integration needed.
In this workspace, run `pnpm --filter @katakit/speech build` before starting a consumer;
the demo development commands do this automatically. Published packages include built assets.

## Microphone transcription

This example works in a plain browser application; no UI framework or plugin is required.
Call `start()` from a user action, such as a button click.

```ts
import { createMicrophoneTranscriber } from '@katakit/speech/browser';

const input = createMicrophoneTranscriber({
  model: 'moonshine-small',
  onState: state => console.log(state.phase, state.progress, state.error?.message),
  onLevel: level => console.log('activity', level), // 0–1, roughly ten updates/second
  onProvisional: text => console.log('preview', text),
  onFinal: segment => console.log('final', segment),
  onStop: () => console.log('session ended'),
});

await input.load(); // Optional preload; does not request microphone permission.
await input.start(); // Also loads lazily when load() was omitted.
// Later, from a Stop button:
await input.stop();
// When the application releases this owner:
await input.dispose();
```

The helper requests mono 16 kHz microphone audio, maintains the audio graph, reports
levels, and delivers the last worklet buffer before draining recognition. Browser support
for microphone access, AudioContext, and AudioWorklet is required. Microphone permission
is requested only on `start()`. Construction has no side effects.

## Models and results

`speechModels` from `@katakit/speech/browser` is the shared catalog for application model
pickers. Its entries include `id`, `label`, `language`, and `provisional`.

| Model ID                    | Language | Behavior                                                                                              |
| --------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `moonshine-tiny`            | English  | Streaming, provisional and final results                                                              |
| `moonshine-small` (default) | English  | Streaming, provisional and final results                                                              |
| `moonshine-medium`          | English  | Streaming, provisional and final results                                                              |
| `whisper-tiny`              | English  | `Xenova/whisper-tiny.en`, quantized; ten-second chunks and a partial tail on stop; final results only |

Every finalized result is a `SpeechSegment`:

```ts
type SpeechSegment = {
  id: string;
  sourceId: string;
  text: string;
  startMs?: number;
  endMs?: number;
};
```

IDs are opaque and distinct within a session. Each `start({ sourceId? })` creates a new
session; an omitted source ID is generated. Times are milliseconds relative to that
session. Whisper timestamps describe audio chunk boundaries, not word alignment.
Provisional text is mutable recognition output and is never a finalized segment.
Switch models by stopping and disposing the old owner before constructing a replacement.

## Lifecycle and errors

Both microphone and PCM utilities share `load()`, `start({ sourceId? })`, `stop()`, and
`dispose()`. Lifecycle operations are serialized. `stop()` closes capture, drains accepted
recognition work, delivers remaining final results, and calls `onStop` once for that
session. It keeps the model loaded for another start. If recognition fails, `onStop` still
marks the end of the session, but some audio may not have been recognized.

`dispose()` is idempotent and terminal. It waits for pending startup/loading to settle,
releases capture/model/worker resources, and suppresses late recognition results. An active
session still receives its `onStop` cleanup notification. Call `stop()` first when you need
all final results. `start()`, `load()`, and `write()` after disposal fail with code `disposed`.

`onState` receives phases `idle`, `loading`, `ready`, `starting`, `running`, `stopping`,
`error`, or `disposed`. State callbacks begin when operations run, rather than at
construction. Progress is a provider-reported fraction when available. State errors are
`SpeechError` objects with `code`, `message`, and optional `cause`.

Awaited operations reject on failure; `write()` throws synchronously. Catch those errors
in application event handlers, and use `onState` to render asynchronous recognition errors.
Examples of error codes are `unsupported-environment`, `cross-origin-isolation-required`,
`microphone-permission-denied`, `microphone-unavailable`, `audio-format-unsupported`,
`model-load-failed`, and `recognition-failed`. Errors release failed recognition resources;
a later start can retry after the cause is addressed. For a raw PCM source, the host must
also stop that source when an asynchronous recognition error arrives.

## Existing PCM and custom hosts

For mono `Float32Array` samples you already own, browser engine setup is available without
microphone capture:

```ts
import { createBrowserTranscriber } from '@katakit/speech/browser';

const speech = createBrowserTranscriber({ model: 'whisper-tiny', onFinal: console.log });
await speech.start({ sourceId: 'session-42' });
speech.write(new Float32Array(16_000), 16_000); // Replace with your PCM.
await speech.stop();
await speech.dispose();
```

Whisper requires 16 kHz input. Moonshine accepts the input sample rate through its SDK.
`write()` accepts mono float PCM in [-1, 1] between an awaited start and stop; callers retain
buffer ownership. It returns after accepting the samples, and inference may complete later.

The base `createTranscriber({ engine, ...callbacks })` accepts a `SpeechEngine` factory.
An engine loads a recognizer and returns `start(sourceId)`, `write(audio, sampleRate)`,
`stop()`, and `close()` methods. It reports progress, provisional text, final segments, and
errors through `EngineEvents`. The `moonshine` factory from `@katakit/speech/moonshine`
accepts `{ model, loadSdk }`; `whisper` from `@katakit/speech/whisper` accepts a compatible
`{ createWorker }` transport. These advanced entry points support custom asset loading and
host integration. Ordinary browser applications use the convenience entry points instead.

## Application settings

| Setting                      | Support boundary                                                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| React browser app            | Use the browser helper; React owns only the UI.                                                                                                |
| Non-React browser app        | Identical helper and asset setup.                                                                                                              |
| Browser extension            | Existing demo uses the PCM engine in its worker, with extension-owned capture and permissions.                                                 |
| Electron renderer            | Candidate for browser helpers when runtime APIs, permissions, and asset/isolation requirements are satisfied; no verified Electron recipe yet. |
| Electron main process / Node | The base orchestrator works with an injected compatible engine; no built-in Node model adapter or microphone implementation.                   |
| Obsidian desktop/mobile      | No verified recipe. Embedded runtime capabilities, packaging, microphone access, and Moonshine isolation must be validated for each host.      |

The package does not infer support from a UI framework or desktop application name.
Browser helpers check runtime capabilities. Moving code into a standalone package does
not bypass host security policies or supply missing runtime APIs.

Chromium smoke checks cover Moonshine Tiny and Whisper Tiny loading, synthetic microphone
capture, audio levels, stopping, and disposal. Whisper also runs without cross-origin
isolation. These checks exercise runtime setup and lifecycle, rather than speech accuracy.
Electron and Obsidian have not been exercised.

## Connect to the transcription plugin

The plugin remains optional and has no dependency on this utility. Its methods accept the
utility's structural segment shape:

```ts
const input = createMicrophoneTranscriber({
  model: 'moonshine-small',
  onProvisional: methods.updateProvisional,
  onFinal: methods.ingestSegment,
  onStop: methods.flush,
});
```

See the [transcription plugin](../transcription/README.md) for constructing `methods` and
reading conversation turns. A different application can send callbacks to its own state,
UI, or storage.

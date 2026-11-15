# @katakit/transcription

Framework- and source-neutral Katakit plugin that groups finalized speech segments into
conversation turns. `events$` publishes live provisional, segment, and completed-turn events;
`conversationTurns$` derives completed turns from those local events; `lastHeard$` exposes
the latest finalized text without the full turn list. `updateProvisional(text)`
shows revisable recognition text without committing it; `ingestSegment(segment)` accepts
finalized lines, deduplicated by source and line ID. `flush()` finalizes an outstanding turn
(for example on Stop); `reset()` clears a session by publishing a local reset event;
`close()` clears the timer and completes the local event stream.
The host owns its audio source and stops it separately.

Configure `turnSilenceMs` to adjust turn boundaries. A source that delivers only long,
late final segments cannot be made low-latency by this setting; it must provide
interim updates. Transcripts are in memory by default and are **not persisted**. Optional
`forward.createEvent`/`forward.emitEvent` callbacks map and send selected events to a host-owned
event log; saved history is not automatically replayed into the plugin on restart.

## Shared model utilities

`@katakit/transcription/models` exports `createTranscriptionModel` for Moonshine Tiny,
Small (default), and Medium Streaming in English, and Whisper Tiny English. Both providers
accept mono `Float32Array` PCM and deliver `onFinal(TranscriptSegment)`. Moonshine also
delivers `onProvisional(text)`. No microphone, device permission, or audio graph is created
by these utilities.

Install `@moonshine-ai/moonshine-wasm@0.1.5` for Moonshine or
`@xenova/transformers@^2.17.2` for Whisper. These are optional peers; the base plugin does
not load either runtime. Connect results directly to the plugin's methods:

```ts
import { makeKatakit } from '@katakit/core';
import { makeTranscriptionPlugin } from '@katakit/transcription';
import { createTranscriptionModel } from '@katakit/transcription/models';

const Transcription = makeTranscriptionPlugin();
const kit = makeKatakit({ plugins: [Transcription.configure({})] });
const methods = kit.start().getMethods(Transcription);
const moonshineAssetBase = '/assets/moonshine/0.1.5/';
const model = createTranscriptionModel({
  provider: 'moonshine',
  model: 'small',
  loadSdk: () => import(/* @vite-ignore */ `${moonshineAssetBase}index.js`),
  onProvisional: methods.updateProvisional,
  onFinal: methods.ingestSegment,
  onStop: methods.flush,
  onState: state => console.log(state.phase, state.progress, state.error),
});

try {
  await model.start(); // Lazy load; model.load() can preload separately.
  model.write(new Float32Array(16_000), 16_000); // Replace with your source's PCM.
  // Stop your source and deliver its last PCM buffer before stopping recognition.
  await model.stop(); // Drain final results, then call onStop. The model stays loaded.
} finally {
  await model.dispose(); // Release resources, including a model still loading.
  methods.close();
}
```

Moonshine's SDK ESM, WASM, and pthread files must be served as siblings. The example's
`loadSdk` URL assumes those files have been copied from the installed SDK's `dist`
directory. See the [demo's asset integration](../../demos/transcription-react/moonshineAssetsPlugin.ts)
for Vite development and builds. Hosting needs a secure, cross-origin-isolated context
with `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` on the document and SDK assets.

For Whisper, create a dedicated worker entry:

```ts
// whisperWorker.ts
import { installWhisperWorker } from '@katakit/transcription/whisper-worker';
installWhisperWorker(self);
```

Replace the Moonshine provider options in the example with:

```ts
provider: 'whisper',
createWorker: () => new Worker(new URL('./whisperWorker.ts', import.meta.url), { type: 'module' }),
```

Whisper requires 16 kHz PCM. It serializes recognition in ten-second chunks and drains
the final partial chunk on `stop()`; there is no provisional text. The worker downloads
`Xenova/whisper-tiny.en` on first load and is terminated on disposal or failure.

Both providers reuse their loaded model across sessions. Each `start()` generates a new
source ID, or accepts an explicit ID; segment times are milliseconds relative to that
session. Lifecycle calls are serialized and `dispose()` is idempotent. Disposal suppresses
late result/state callbacks; call `stop()` first when you need all final results. Failures
report an `error` state, release resources, and reject the operation (or throw from
`write`); a later `start()` can retry. After an asynchronous error, the host should also
stop its audio source. Call `dispose()` before replacing a model.

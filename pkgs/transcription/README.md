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

## Speech recognition utilities

[`@katakit/speech`](../speech/README.md) provides independent microphone and PCM transcription
utilities for Moonshine and Whisper. It has no React, RxJS, or plugin-system dependency.
The transcription plugin does not depend on that utility package. Connect its callbacks
when you want recognized speech grouped into conversation turns:

```ts
import { createMicrophoneTranscriber } from '@katakit/speech/browser';

// methods comes from your running transcription plugin.
const input = createMicrophoneTranscriber({
  model: 'moonshine-small',
  onProvisional: methods.updateProvisional,
  onFinal: methods.ingestSegment,
  onStop: methods.flush,
});
await input.start();
// Later: await input.stop(); await input.dispose();
```

Use `speechAssetsPlugin` in Vite or `copySpeechAssets` with another toolchain to install
the runtime files. See the utility's README for model requirements, asset hosting, errors,
and examples that do not use a plugin or UI framework.

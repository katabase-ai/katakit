# React transcription example

## Run it locally

This revision requires the checkout's event-sourced Katakit APIs. The pinned npm `0.1.0`
packages do not provide them, so independent copies currently fail to build. Until compatible
packages are released and the pins are updated, use the repository commands under
[Standalone setup](#standalone-setup). The copy commands below describe the intended
published-package workflow.

Copy this demo from GitHub and start it. You need Node.js 24 or newer and pnpm:

```sh
npx degit katabase-ai/katakit/examples/demos/transcription-react local-transcription
cd local-transcription
pnpm install
pnpm dev
```

The gallery's **Get the code** control shows the same command and a prompt for a coding agent.

## Prepare an independent copy from a checkout

From an installed Katakit checkout, run:

```sh
pnpm examples:copy demos/transcription-react /tmp/my-transcription-react
cd /tmp/my-transcription-react
pnpm install
pnpm build
pnpm dev
```

## Standalone setup

Use Node.js 24 or newer and pnpm 11.9.0. Copy this entire directory anywhere outside the
repository; no gallery, sibling example, or shared application UI is needed.
React, React-RxJS, Vite, TypeScript, and the utility dependencies are declared
in `package.json`.

Run the example from its own directory:

```sh
pnpm dev
```

Open the localhost URL printed by Vite. `pnpm build` creates `dist/`;
`pnpm tsc` checks types and `pnpm test:ci` runs the tests.
Inside the repository, build the utility before starting the example:

```sh
pnpm install
pnpm -F @katakit/transcription build
pnpm -F @katakit/demo-transcription dev
```

## Using the example

Choose Moonshine Tiny, Small (the default), or Medium Streaming, or Whisper Tiny
English. Grant microphone access and speak; finalized lines are grouped into
conversation turns. Moonshine offers live provisional text. Whisper runs in a
worker on roughly ten-second audio chunks, so its text appears later and has no
live preview.

The first use of each model downloads its assets from its provider. Audio stays
in the browser and is not sent to an application server. Transcripts are held in
memory and cleared on reload. Stop drains pending recognition and flushes the
current turn. Change models only between recordings: the old model is closed,
existing turns remain visible, and each recording gets a distinct source ID.

## Event model and session ownership

One `createTranscriptionDemo()` instance is one visit. Pausing capture or changing models
keeps its transcript; navigating away closes it, and a fresh visit starts with an empty log.
The ingestion plugin already supplies the domain events, so this demo reuses that log rather
than copying turns into a second application history:

| Event                       | Recorded fact                                                           | Derived view                                       |
| --------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| `utteranceAdded`            | An accepted final segment, with source-scoped ID, text, and audio times | Pending turn and accepted utterances               |
| `conversationTurnAdded`     | A completed turn, including its assigned ID and accepted text           | Completed turns; clears the pending turn and draft |
| `provisionalUtteranceAdded` | The latest recognition draft (including an empty draft on flush)        | Provisional text, cleared by finalized input       |

These events are TypeScript `KatakitEvent` declarations exported by
`@katakit/transcript-ingestion` as `UtteranceAddedEvent`, `ConversationTurnAddedEvent`, and
`ProvisionalUtteranceAddedEvent` (together, `TranscriptIngestionEvent`). Ingestion methods
record those events in `EventLogPlugin`; ingestion observables project the transcript from
that log. The demo adapts recognition callbacks and combines those projections for React.
It does not define a second event model or runtime event schemas.

`src/transcriptInput.ts` owns live admission and turn timing. It trims final text, ignores
blank input, and deduplicates the pair of recording `sourceId` and recognizer-local segment
`id`. The encoded pair is the utterance ID; `speaker` preserves the source ID, not a detected
person. A different source or an audio gap greater than 1,400 ms flushes the previous turn.
Otherwise, delivery-time silence or an explicit `flush()` completes it. Missing start time
defaults to zero and missing end time to the start; gap checks use those recorded boundaries
and a supplied next start time, consistently for live and restored histories.
If a segment ends before the pending turn's start (for example after a clock reset or missing
timestamps), the adapter completes the pending turn first so both turns retain valid ranges.

`src/createTranscriptionDemo.ts` combines ingestion projections into a read-only `state$`
with `.get()`. It replaces the former writable `BehaviorSubject` mirror. React bindings are
created once per runtime; both the standalone view and gallery microphone test use a
`Subscribe` boundary. Unmounting a view releases its UI subscription, not capture or the log.

The standalone `App.tsx` owns the microphone/model switcher. The gallery owns its shared
microphone and visit lease. Those owners stop and drain capture, call `flush()` for the final
turn, then call the demo's `close()`. Close cancels the ingestion timer, completes the combined
view, and ignores late input. It does not finalize a pending turn on its own or dispose the
host's microphone. Core has no general runtime disposal method; internal log/projection
objects remain in memory while a caller retains the runtime or history.

### Restore recorded history

The demo keeps typed history in memory; it has no persistence or JSON import format.
The old UI did not save transcripts, so there is no legacy snapshot to convert. Callers can
capture the current log and explicitly restore a new instance:

```ts
import { createTranscriptionDemo } from './src/createTranscriptionDemo';

const live = createTranscriptionDemo();
live.ingestSegment({ sourceId: 'recording-1', id: 'segment-1', text: 'Hello.' });
live.flush();
const saved = live.events$.getAll(); // TranscriptIngestionEvent[], including Date metadata
live.close();

const restored = createTranscriptionDemo({ initialEvents: saved });
console.log(restored.state$.get().completedTurns[0]?.text); // Hello.
restored.close();
```

`initialEvents` accepts a complete `readonly TranscriptIngestionEvent[]` from an existing
runtime. Records and their metadata are copied before seeding the new log; replay does not
revalidate accepted events. Keep full histories, not filtered subsets, and do not mutate
recorded facts. Source deduplication is reconstructed from recorded utterances. If an application
adds storage or accepts external JSON, decoding and validation belong at that separate input
boundary, before passing typed events to the runtime.

Replay restores completed turns, pending text, and the last draft without generating turn IDs,
restarting the silence timer, or acquiring a recognizer. Pending text stays pending until new
live input or an explicit `flush()` advances it. Closing a restored instance cancels resources
without adding events. Draft history describes recognition at capture time; it does not mean
the microphone is currently running.

See [Designing event-sourced applications](https://github.com/katabase-ai/katakit/blob/main/docs/pages/reference/event-sourcing.md)
for the architecture and [the migration walkthrough](https://github.com/katabase-ai/katakit/blob/main/docs/pages/getting-started/migrate-to-event-sourcing.md)
for moving an existing mutable-state application to these patterns.

### Verification

Run `pnpm -F @katakit/demo-transcription test:ci` and
`pnpm -F @katakit/demo-transcription tsc` from the repository root. The tests exercise typed-history
replay, stable IDs, no replay timers, invalid live input, duplicate delivery across restoration,
source/gap boundaries, late callbacks after close, final stop delivery, and React remount/runtime
replacement. These use controlled text and engine callbacks, not microphone audio or real models.

Run `pnpm demos:copy-check transcription-react` to install, build, typecheck, test, and check
assets outside the workspace against freshly packed local Katakit libraries. Use
`pnpm gallery:copy-check` after changing gallery integration. Registry checks with `--registry`
test published versions instead; workspace and packed-library success do not establish that
the current source is compatible with older npm releases.

The registry check currently fails against the pinned `0.1.0` packages: core lacks
`EventLogPlugin` and `existingEvents`, and ingestion lacks `TranscriptIngestionEvent` and
the current methods/projections. Both transcription and gallery copy checks pass with
freshly packed checkout libraries. Release compatible packages, update the example pins,
and rerun the registry check before treating plain npm copies as verified.

For a live browser check: speak a partial turn, stop and confirm its last words are retained;
resume recording and verify earlier turns remain; change models between recordings and check
both sources remain visible; navigate away in the gallery and verify a fresh visit is empty.
Real microphone permissions, recognition quality, and model downloads need those separate checks.

## Modifying and hosting

Edit `src/App.tsx` for React UI and transcript wiring, `src/controls.tsx` and
`src/AudioLevelMeter.tsx` for controls, and `src/base.css`, `src/style.css`, and
`src/audio-level-meter.css` for styling. Model selection and transcript wiring
are local. The transcription utility owns microphone capture, speech recognition, workers, and runtime asset serving.

Microphone access requires a secure, cross-origin-isolated context. Vite serves
the required headers on localhost. Static hosting must serve
`Cross-Origin-Opener-Policy: same-origin` on the document and
`Cross-Origin-Embedder-Policy: require-corp` on the document and runtime assets.
`transcriptionAssetsPlugin` includes the installed speech runtime in
`dist/transcription-assets/`.

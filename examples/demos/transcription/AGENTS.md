# Working on local transcription

The [README](README.md) describes what this example demonstrates. This guide covers
running and modifying an independent copy.

## Setup and commands

Use Node.js 24 or newer and pnpm 11.9.0. To get the example:

```sh
npx degit katabase-ai/katakit/examples/demos/transcription local-transcription
cd local-transcription
```

From the copied directory:

```sh
pnpm install
pnpm dev
```

Open the localhost URL printed by Vite. `pnpm build` creates `dist/`, `pnpm tsc`
checks types, and `pnpm test:ci` runs tests. Keep the whole directory when copying
it again; dependencies and runtime asset setup are declared locally.

## Use the demo

Choose Moonshine Tiny, Small (the default), or Medium Streaming, or Whisper Tiny
English. Grant microphone access and speak; finalized segments are grouped into
conversation turns. Moonshine provides provisional text. Whisper processes roughly
ten-second audio chunks, so text appears later and has no live preview.

The first use of each model downloads assets from its provider. Audio stays in the
browser. Transcripts are held in memory and cleared on reload. Stop drains pending
recognition and flushes the current turn. Change models between recordings: the old
model is disposed before its replacement is created, existing turns remain visible,
and each recording gets a distinct source ID.

## Code organization

- `src/app.tsx` mounts React, loads the standalone styles, and renders the standalone
  transcription component. The app entry mounts the page on load.
- `src/transcription/transcription.tsx` owns the standalone runtime, microphone,
  model selection, and controls. Gallery hosts use the view and runtime modules directly.
- `src/transcription/TranscriptView.tsx` displays completed, pending, and provisional transcript text.
- `src/transcription/transcriptInput.ts` adapts recognition callbacks to transcript ingestion,
  including source IDs, duplicate filtering, and turn boundaries.
- `src/transcription/createTranscriptionDemo.ts` combines ingestion projections into read-only
  `state$`, exposes typed history, and creates stable React-RxJS bindings for the visit.
- `src/transcription/models.ts` describes model choices; `src/transcription/createModelSwitcher.ts` serializes
  model disposal and replacement.
- `src/ui/` contains local visual primitives (`controls.tsx`, `AudioLevelMeter.tsx`)
  and their styles. Keep domain components outside this directory.
- `src/base.css` contains the standalone theme and global resets; import it only from
  `src/app.tsx`. `src/ui/controls.tsx` imports its own `controls.css`, and
  `src/ui/AudioLevelMeter.tsx` imports `audio-level-meter.css`.
- `src/transcription/style.css` contains demo-specific layout and transcript styling.
- `tests/` covers typed replay, input admission, shutdown, model selection, transcript integration,
  and React remount/runtime replacement.

## Modification rules

Keep application code, styles, and assets inside this directory and import Katakit
through public package entry points. Keep controls local so a copied application can
change its appearance without adopting a shared UI package.

Transcript content derives from transcript ingestion's logged events. Keep provisional
speech separate from finalized input, preserve source/segment IDs, and flush final
results on Stop. Changing models must not discard existing transcript turns.

`src/transcription/transcription.tsx` owns the microphone/model switcher and transcript runtime.
The gallery owns shared capture and a visit lease instead. These hosts stop and drain input,
flush the final turn, then close the session. `createTranscriptionDemo.close()` cancels the
ingestion timer, completes its combined view, and ignores late input; it does not flush a
pending turn or stop the host's microphone. The view's `Subscribe` boundary releases only its
UI subscription on unmount. Core has no general runtime disposal method; internal log and
projection objects remain in memory while a caller retains the runtime or history.

## Event model and replay

One session spans recording pauses and model changes. Leaving the page closes the session;
a new visit starts empty. Ingestion's existing event log owns the transcript:

| Event                       | Accepted fact                                               | Projection                                     |
| --------------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| `utteranceAdded`            | Final text, source-scoped ID, and audio times               | Pending turn and accepted utterances           |
| `conversationTurnAdded`     | Completed turn with its assigned ID, text, and times        | Completed turns; clears pending text and draft |
| `provisionalUtteranceAdded` | Latest recognition draft, including an empty draft on flush | Provisional text, cleared by finalized input   |

These are TypeScript `KatakitEvent` declarations exported by `@katakit/transcript-ingestion`
as `UtteranceAddedEvent`, `ConversationTurnAddedEvent`, and `ProvisionalUtteranceAddedEvent`
(the `TranscriptIngestionEvent` union). Reuse those types and projections. The demo has no
second event model, writable transcript mirror, or runtime event schemas.

`transcriptInput.ts` trims final text, ignores blank input, and deduplicates the pair of
recording `sourceId` and recognizer-local segment `id`. The encoded pair is the utterance ID;
`speaker` retains the source ID, not a detected person. A new source or audio gap greater than
1,400 ms flushes the previous turn. Otherwise delivery-time silence or an explicit `flush()`
completes it. Missing start time defaults to zero; missing end time defaults to the start.
If the next segment ends before the pending turn's start, the adapter flushes first to preserve
valid turn ranges after missing timestamps or a clock reset. IDs and finite, nonnegative,
ordered audio times are checked before admission.

History is typed and in memory, with no persistence or JSON import format. The previous UI
did not save transcripts, so there is no legacy snapshot to migrate. To restore a session:

```ts
import { createTranscriptionDemo } from './src/transcription/createTranscriptionDemo';

const live = createTranscriptionDemo();
live.ingestSegment({ sourceId: 'recording-1', id: 'segment-1', text: 'Hello.' });
live.flush();
const saved = live.events$.getAll(); // TranscriptIngestionEvent[], including Date metadata
live.close();

const restored = createTranscriptionDemo({ initialEvents: saved });
console.log(restored.state$.get().completedTurns[0]?.text); // Hello.
restored.close();
```

Pass a complete `readonly TranscriptIngestionEvent[]`, not a filtered subset. Seed records
and metadata are copied; replay does not revalidate accepted facts. Do not mutate recorded
facts. If adding external storage or JSON input, decode and validate that format at its input
boundary before passing typed events to the runtime.

Replay reconstructs source deduplication, completed turns, pending text, and the last draft
without generating turn IDs, restarting timers, or acquiring a recognizer. Pending text stays
pending until live input or `flush()` advances it. Closing a restored instance adds no events.
A restored draft describes recognition at capture time, not whether a microphone is now running.

See [Designing event-sourced applications](https://github.com/katabase-ai/katakit/blob/main/docs/pages/event-sourcing/designing.md)
and [Migrate an existing application](https://github.com/katabase-ai/katakit/blob/main/docs/pages/event-sourcing/migration.md)
for the shared design method and a walkthrough starting from mutable state.

## Hosting and verification

Microphone access needs a secure, cross-origin-isolated context. Vite supplies the
headers on localhost. Static hosting must serve `Cross-Origin-Opener-Policy: same-origin`
on the document and `Cross-Origin-Embedder-Policy: require-corp` on the document and
runtime assets. The Vite `transcriptionAssetsPlugin` copies installed speech runtime
files into `dist/transcription-assets/`; deploy those assets with the page.

After changes, run `pnpm tsc`, `pnpm test:ci`, and `pnpm build`. Test deliberately at
behavior boundaries rather than mirroring implementation details. For UI or capture
changes, also check in a browser:

- Start/stop capture, model loading, and denied microphone permission.
- Speak with Moonshine and verify provisional text, completed turns, and final text on Stop.
- Switch to Whisper between recordings; verify delayed results and retained earlier turns.
- Check that model switching is disabled while recording or busy, and that microphone
  capture ends when leaving the page.
- Check narrow layouts and keyboard access.

Builds and synthetic tests do not establish real microphone or recognition behavior.
Report manual checks separately.

From a Katakit checkout, run `pnpm demos:copy-check transcription` and `pnpm gallery:copy-check`
to check clean installs, builds, types, tests, assets, and HTTP isolation against freshly packed
libraries. Add `--registry` to test published versions instead. Replay tests use controlled
text and engine callbacks, not microphone audio or real models.

# Structured notes

## Run it locally

Copy this demo from GitHub and start it. You need Node.js 24 or newer and pnpm:

```sh
npx degit katabase-ai/katakit/examples/demos/notes structured-notes
cd structured-notes
pnpm install
pnpm dev
```

The gallery's **Get the code** control shows the same command and a prompt for a coding agent.

## Prepare an independent copy from a checkout

From an installed Katakit checkout, run:

```sh
pnpm examples:copy demos/notes /tmp/my-notes
cd /tmp/my-notes
pnpm install
pnpm build
pnpm dev
```

This React example turns on-device speech recognition into a two-level outline rendered as Markdown.
Start listening captures locally and, when a connection is configured, connects the model. Finalized turns then trigger requests. Later speech can correct a
misheard name in an existing note. The transcript keeps the original recognition text.

## Run the standalone example

From the Katakit repository root:

```sh
pnpm install
pnpm -F @katakit/demo-notes... build
pnpm -F @katakit/demo-notes dev
```

Set `VITE_NOTES_ENDPOINT` to an OpenAI-compatible chat-completions endpoint and
`VITE_NOTES_CREDENTIAL` to its credential in an ignored `examples/demos/notes/.env.local` file.
The endpoint must accept browser requests from your local origin. The standalone host uses
`z-ai/glm-5.3`. These Vite values are visible in the browser; use this host locally with your own
connection. A public host should supply anonymous admission through its own proxy instead.

The dev server serves the packaged worker/WASM assets and cross-origin isolation headers.
Click **Start listening** to load the recognizer and request microphone access. Audio stays on-device.
Listening also connects to your model endpoint and sends finalized transcript
turns with the existing outline. Stop listening to stop sending. A failed connection or request is retried twice on its own; after that, pausing and resuming listening tries again. A hosted connection may require browser verification first.

## Embed the example

The gallery exports `notesGalleryDemo` from `gallery/shared/galleryDemos.tsx`. Its lazy
component takes no props: it uses the host's `GallerySpeechProvider` and the model connection the
host passes to `Gallery` as `connectModel`. Catalogue metadata and source paths live in Katakit.
A host can consume them through an exact source pin without publishing a demo package. Without a
connection, the public gallery still demonstrates transcription.

`renderModelControls` receives connection status and errors. The gallery uses it
to render them inside the demo with the host’s browser check and a usage meter.
Without this callback, controls render above the outline. Usage is measured in requests. Errors
and allowance never become note content.

For a standalone embed, copy this directory and use `App`:

```tsx
import { App } from './src/App';

<App
  connect={async ({ signal }) => ({
    model: 'z-ai/glm-5.3',
    maxBodyBytes: 16384,
    maxOutputTokens: 1024,
    requestCompletion: async ({ body, signal: requestSignal }) => {
      // Admit a connection in connect; forward body with both abort signals respected.
      // Return the parsed chat-completions response body; the example reads its notes out of it.
      return yourModelConnection.request({
        body,
        signal: AbortSignal.any([signal, requestSignal]),
      });
    },
  })}
/>;
```

`connect` runs when `listening` becomes true, never on page load, model
download, or microphone permission. Changing the `connect` function aborts admission and inference
without clearing content, then connects again if still listening; memoize it in hosts.
A failed admission is retried twice automatically, and a session whose failure has the `restart`
policy is admitted again twice per listening start. Stop/start reuses a working connection and
gives a failed one another attempt; an exhausted (`terminal`) session is never retried.
Once notes have been started, stopping capture still lets its final turns produce notes. The host owns authorization and transport errors.
A failed request is retried twice by default; `NotesRequestError` policies change the limit
(`retryLimit: 0` for failures another attempt cannot fix) and delay, or mark it terminal or restart.
A response that misuses a note ID is applied without the misplaced part instead of failing: an
unknown reword is dropped, detail aimed at a nested note joins its siblings, and an addition under
an unknown ID becomes a top-level note. Note IDs are short so a model can copy them back exactly.
Quota exhaustion should be terminal and never clearable. Only a context-limit failure is clearable.
An optional `reportFailure` callback receives `NotesRequestError` after transport or validation
fails. Hosts can log its policy code with their last request ID. The example reads the response
body itself: `response_format`, `response_truncated`, `response_unfinished`, and `response_json`
mean the completion was malformed, cut off, stopped early, or not JSON. `notes_schema` means the result
failed validation; `notes_target` means it referred to a nonexistent note. Keep diagnostics free
of transcript and generated text. A completed request may legitimately add no visible notes.

Use `transcriptionAssetsPlugin({ isolate: true })` from `@katakit/transcription/vite` in Vite hosts.
Production must serve COOP `same-origin` and COEP `require-corp` on every entry document, plus
COEP `require-corp` on transcription worker responses. The plugin copies runtime assets into the
client build output. It sets local dev/preview headers; your production server owns response headers.

## Behavior and verification

`createNotesDemo({ initialEvents })` restores the notes runtime's built-in event log.
Finalized transcript turns append `transcriptTurn` events. Each validated model result appends a
`notesUpdated` event containing the complete accepted outline, stable IDs, and processed-turn cursor.
Clear appends `notesCleared` with the current cursor. The notes plugin derives content from these
events. Admission, retries, cancellation, and errors remain transient.

Read `runtime.events$.getAll()` to capture the event history, including each record's `meta`.
The demo validates payloads and metadata and restores timestamps from JSON when loading `initialEvents`. Replay restores the outline and original
transcript without generating IDs or calling a model. An explicit connection can process turns
remaining after the recorded cursor. The example keeps its history in memory for one visit.

Markdown is a projection of the structured outline. The model still returns validated additions
and rewords. A thin Transcript column sits to the right of the notes and stays in view as they grow.
It shows one line per finalized segment, newest first, running to the bottom of the page when
speech is fast; older lines are lighter by position and each expires after twenty seconds, leaving
from the end of the list.
The line being spoken is italic and keeps its place when it is finalized.

Display timing comes from live ingestion events, not the replayable history. Old transcript does not
reappear on replay or after model updates. All finalized turns remain available to inference and replay.

The notes plugin sends one request at a time. It retains turns that arrive during an in-flight
request and dispatches them immediately afterward. It validates additions and rewords together
before advancing the cursor. Clearing notes aborts the request and discards late results.
Unmounting aborts admission and model requests immediately. The input owner then drains capture
before closing the runtime. The gallery retains a ready recognizer across routes; standalone
unmount releases it. Pending microphone permission is cancelled, including late grants.

## Copy outside the workspace

Run `pnpm install` and `pnpm build` in the copied directory.
The manifest includes `react-markdown` for rendering, `ts-pattern` for exhaustive event handling,
and `es-toolkit` for abortable retry delays.
The included `pnpm-workspace.yaml` allows the `esbuild` install script.

Requests include the full outline, pending turns, and up to six preceding context turns. The
complete UTF-8 body must fit the host's limit. Oversized input pauses instead of silently dropping
notes or turns. Quota failures pause notes while transcription continues.

Run `pnpm -F @katakit/demo-notes test:ci` and `pnpm -F @katakit/demo-notes tsc` from the repository
root. The tests use controlled model responses. Real speech recognition, spelling correction
quality, and provider latency require separate browser/model checks.

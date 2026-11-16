# Structured notes

This React example turns on-device speech recognition into a two-level outline rendered as Markdown.
Starting the microphone connects the model automatically. Finalized turns trigger requests. Later speech can correct a
misheard name in an existing note. The transcript keeps the original recognition text.

## Run the standalone example

From the Katakit repository root:

```sh
pnpm install
pnpm -F @katakit/demo-notes... build
pnpm -F @katakit/demo-notes dev
```

Set `VITE_NOTES_ENDPOINT` to an OpenAI-compatible chat-completions endpoint and
`VITE_NOTES_CREDENTIAL` to its credential in an ignored `demos/notes-react/.env.local` file.
The endpoint must accept browser requests from your local origin. The standalone host uses
`z-ai/glm-5.3`. These Vite values are visible in the browser; use this host locally with your own
connection. A public host should supply anonymous admission through its own proxy instead.

The dev server serves the packaged worker/WASM assets and cross-origin isolation headers.
Click **Start listening** to load the recognizer and request microphone access. Audio stays on-device.
Once listening starts, the example connects to your model endpoint and sends finalized transcript
turns with the existing outline. A hosted connection may require browser verification first.

## Embed the example

The gallery exports `notesGalleryDemo` from `demos/gallery/shared/galleryDemos.tsx`. Its lazy
component accepts `connect` and `renderModelControls` and uses the host's `GallerySpeechProvider`. Catalogue metadata and
source paths live in Katakit. A host can consume them through an exact source pin without
publishing a demo package. Without a connection, the public gallery still demonstrates transcription.

`renderModelControls` receives connection status, retry buttons, and errors. A host can return a React
portal into `GallerySpeechControls`' children slot, alongside its own verification widget and usage
display. Without this callback, controls render above the outline. Usage is host-owned and measured
in requests. Errors and allowance never become note content.

For a standalone embed, copy this directory and use `App`:

```tsx
import { App } from './src/App';

<App
  connect={async ({ signal }) => ({
    model: 'z-ai/glm-5.3',
    maxBodyBytes: 16384,
    maxOutputTokens: 1024,
    requestNotes: async ({ body, signal: requestSignal }) => {
      // Admit a connection in connect; forward body with both abort signals respected.
      // Return the parsed JSON from choices[0].message.content, not the completion envelope.
      return yourModelConnection.request({
        body,
        signal: AbortSignal.any([signal, requestSignal]),
      });
    },
  })}
/>;
```

`connect` runs once the microphone is listening, never on page load, model download, or pending
microphone permission. It may run again on an explicit connection retry or session restart.
Stop/start reuses admission and the connection, including failed or exhausted sessions.
Stopping capture still lets its final turns produce notes. The host owns authorization and transport errors.
`NotesRequestError` supplies bounded retry, terminal, and explicit restart policies.
Quota exhaustion should be terminal and never clearable. Only a context-limit failure is clearable.
An optional `reportFailure` callback receives `NotesRequestError` after transport or validation
fails. Hosts can log its policy code with their last request ID. `notes_schema` means the result
failed validation; `notes_target` means it referred to a nonexistent note. Keep diagnostics free
of transcript and generated text. A completed request may legitimately add no visible notes.

Use `transcriptionAssetsPlugin({ isolate: true })` from `@katakit/transcription/vite` in Vite hosts.
Production must serve COOP `same-origin` and COEP `require-corp` on every entry document, plus
COEP `require-corp` on transcription worker responses. The plugin copies runtime assets into the
client build output. It sets local dev/preview headers; your production server owns response headers.

## Behavior and verification

`createNotesDemo({ initialEvents })` registers `@katakit/event-log` with `NotesEventSchema`.
Finalized transcript turns append `transcriptTurn` events. Each validated model result appends a
`notesUpdated` event containing the complete accepted outline, stable IDs, and processed-turn cursor.
Clear appends `notesCleared` with the current cursor. The notes plugin derives content from these
events. Admission, retries, cancellation, and errors remain transient.

Read `runtime.events$.getAll()` to capture the event history. Validate serialized history with
`NotesEventSchema` before supplying it as `initialEvents`. Replay restores the outline and original
transcript without generating IDs or calling a model. An explicit connection can process turns
remaining after the recorded cursor. The example keeps its history in memory for one visit.

Markdown is a projection of the structured outline. The model still returns validated additions
and rewords. The UI shows the last eight turns in a fixed-height, fading transcript region and
follows the newest words. All finalized turns remain available to inference and replay.

The notes plugin sends one request at a time. It retains turns that arrive during an in-flight
request and dispatches them immediately afterward. It validates additions and rewords together
before advancing the cursor. Clearing notes aborts the request and discards late results.
Unmounting aborts admission and model requests immediately. The input owner then drains capture
before closing the runtime. The gallery retains a ready recognizer across routes; standalone
unmount releases it. Pending microphone permission is cancelled, including late grants.

## Copy outside the workspace

This directory has its own TypeScript/Vite configuration and dependency manifest. While the
Katakit libraries remain unpublished, build and pack `@katakit/core`, `@katakit/event-log`,
`@katakit/transcript-ingestion`, and `@katakit/transcription` from one commit. Install those tarballs in the copied directory, then
run `pnpm install` and `pnpm build`. Keep their versions compatible. The example's dependencies
use ordinary versions so published libraries can replace those tarballs when available.
The manifest also includes `react-markdown` for the outline renderer.
With pnpm 11, use `pnpm-workspace.yaml` overrides for all four tarballs so transitive Katakit
dependencies also resolve locally. Allow the `esbuild` install script in that file.

Requests include the full outline, pending turns, and up to six preceding context turns. The
complete UTF-8 body must fit the host's limit. Oversized input pauses instead of silently dropping
notes or turns. Quota failures pause notes while transcription continues.

Run `pnpm -F @katakit/demo-notes test:ci` and `pnpm -F @katakit/demo-notes tsc` from the repository
root. The tests use controlled model responses. Real speech recognition, spelling correction
quality, and provider latency require separate browser/model checks.

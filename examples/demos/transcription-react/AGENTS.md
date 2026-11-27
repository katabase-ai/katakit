# Working on local transcription

The [README](README.md) describes what this example demonstrates. This guide covers
running and modifying an independent copy.

## Setup and commands

Use Node.js 24 or newer and pnpm 11.9.0. To get the example:

```sh
npx degit katabase-ai/katakit/examples/demos/transcription-react local-transcription
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
- `src/transcription/createTranscriptionDemo.ts` exposes transcript state and owns its subscription.
- `src/transcription/models.ts` describes model choices; `src/transcription/createModelSwitcher.ts` serializes
  model disposal and replacement.
- `src/ui/` contains local visual primitives (`controls.tsx`, `AudioLevelMeter.tsx`)
  and their styles. Keep domain components outside this directory.
- `src/ui/base.css` contains the standalone theme/reset and control styles; import it
  only from the standalone entry point. `src/ui/audio-level-meter.css` styles the meter.
- `src/transcription/style.css` contains demo-specific layout and transcript styling.
- `tests/` covers model selection, transcript integration, and React subscription behavior.

## Modification rules

Keep application code, styles, and assets inside this directory and import Katakit
through public package entry points. Keep controls local so a copied application can
change its appearance without adopting a shared UI package.

Transcript content derives from transcript ingestion's logged events. Keep provisional
speech separate from finalized input, preserve source/segment IDs, and flush final
results on Stop. Changing models must not discard existing transcript turns.

`transcription/transcription.tsx` owns the microphone/model switcher and transcript runtime. Its cleanup stops
active capture, disposes the model owner, and then closes the transcript runtime.
`createTranscriptionDemo` releases its subscription and closes transcript ingestion;
the view releases its own subscription on unmount. Preserve this ordering and do not
assume Katakit core provides a general runtime disposal method.

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

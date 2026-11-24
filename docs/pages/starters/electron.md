# Electron application starter

The [Electron starter](https://github.com/katabase-ai/katakit/tree/main/examples/starters/electron) is a desktop application that recognizes microphone speech locally with Moonshine Tiny. Its window displays provisional speech and completed Katakit conversation turns.

Electron's main process creates the window and serves the built application. The renderer owns the microphone, recognition, Katakit runtime, and view: `src/main.ts` connects recognition callbacks to `src/kit.ts` and displays the resulting turns. Both processes run on the user's computer; this is a client application, not a hosted service.

### Status and limitations

The starter captures microphone audio, not system audio, and does not persist transcripts or include an installer. Live checks have covered macOS; other operating systems, packaging, and signing remain unverified. See the [README's verification record](https://github.com/katabase-ai/katakit/blob/main/examples/starters/electron/README.md#verification).

## Get started

Follow the [starter README](https://github.com/katabase-ai/katakit/blob/main/examples/starters/electron/README.md#copy-and-run) for exact copy, install, check, and launch commands. No separate development server is needed. Choose **Record microphone**, grant microphone access, and wait for the first model download. Speak, then choose **Stop recording** to finish the last turn.

## Platform considerations

### Main and renderer boundaries

`electron/main.cjs` serves the built renderer at the secure `katakit://app` origin and supplies COOP/COEP headers. It grants media permission only to that local origin, disables Node integration, and keeps the renderer sandboxed. Adapt the input and UI in the renderer rather than enabling Node integration or weakening the origin boundary.

`vite.config.ts` packages recognition workers, the audio worklet, and WASM/SDK assets. Preserve those files and response headers when changing packaging. See [Transcription utilities](../reference/transcription.md) for shared runtime requirements.

### Data and input lifetime

Audio and text stay on the device; dependency installation and first model download require network access. Turns are kept in memory. `src/main.ts` disposes the input on page hide; Stop drains final recognition results. Closing and reopening the window clears its transcript. If adding windows or background recording, give each input a clear owner and shutdown path.

## Make it yours

- **Change the input:** replace the recognizer wiring in `src/main.ts`, preserving provisional/final separation and Stop/flush behavior.
- **Change application behavior:** assemble plugins in `src/kit.ts` and derive application content from events.
- **Change the interface:** adapt the renderer in `src/main.ts`; keep privileged desktop operations behind a deliberately designed main/renderer boundary.
- **Add persistence:** introduce an explicit storage owner and restoration path using [event-log persistence](../reference/plugins/persistence.md). Decide where data is stored and how it is cleared before adding filesystem access.

## Additional resources

- [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model) — the responsibilities of main and renderer processes.
- [Electron security recommendations](https://www.electronjs.org/docs/latest/tutorial/security) — boundaries to retain when extending the application.
- [Electron application distribution](https://www.electronjs.org/docs/latest/tutorial/application-distribution) — next steps for packaging and distributing a desktop app.

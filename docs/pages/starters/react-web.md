# React application starter

The [React starter](https://github.com/katabase-ai/katakit/tree/main/examples/starters/react-web) is a browser application that recognizes microphone speech locally with Moonshine Tiny and displays Katakit conversation turns. Its interface includes recording controls, provisional speech, and completed turns.

`src/main.tsx` connects `createMicrophoneTranscriber` callbacks to the methods in `src/katakit.ts`. That module assembles transcript ingestion and exposes the turn observable. Finalized recognition segments become Katakit turns; provisional speech is displayed separately. React subscribes to these results, and the input is disposed when the interface unmounts.

### Status and limitations

Turns are held in memory and disappear on reload. Live microphone checks have covered Chrome on macOS; other browsers and deployed hosting remain unverified. See the [README's verification record](https://github.com/katabase-ai/katakit/blob/main/examples/starters/react-web/README.md#verification) for tested versions and remaining checks.

## Get started

Follow the [starter README](https://github.com/katabase-ai/katakit/blob/main/examples/starters/react-web/README.md#copy-and-run) for prerequisites and exact copy, install, build, and run commands. Open its localhost URL, choose **Start recording**, and grant microphone access. First use downloads model weights. Speak, then choose **Stop recording** to finish the last turn.

## Platform considerations

### Hosting and model assets

Production hosting needs HTTPS and COOP/COEP response headers for Moonshine's shared-memory WASM runtime. Vite supplies these headers locally; deployment must supply them too. `vite.config.ts` packages the worker, worklet, WASM, and SDK assets. See [Transcription utilities](../reference/transcription.md) for hosting and recognition requirements.

### Data and input lifetime

Recognition runs on the device. The first model download contacts its provider, but the starter does not send audio or transcripts to an application server. Stop flushes remaining text; disposal releases the microphone and recognition resources. Preserve that ownership when replacing the input or changing how the React root is mounted.

## Make it yours

- **Change the input:** replace the recognizer wiring in `src/main.tsx`. Keep provisional updates distinct from finalized segments, retain source/segment IDs, and flush remaining text on Stop.
- **Change application behavior:** assemble additional plugins in `src/katakit.ts`. Derive application content from events rather than introducing a second writable state store.
- **Change the interface:** adapt the React components and observable subscriptions in `src/main.tsx`; release subscriptions and input resources when their owner unmounts.
- **Add persistence:** the current turns are memory-only. Connect an explicit storage owner to the [event log and persistence APIs](../reference/plugins/persistence.md), and decide how saved data is restored and cleared.

## Additional resources

- [React documentation](https://react.dev/learn) — component structure, state, and effects when adapting the interface.
- [Vite deployment guide](https://vite.dev/guide/static-deploy.html) — building and serving the application; configure the required isolation headers on your chosen host.
- [Cross-origin isolation](https://web.dev/articles/coop-coep) — how COOP and COEP enable shared-memory browser features.

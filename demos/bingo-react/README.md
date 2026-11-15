# Browser conversation bingo demo

From the repository root, run `pnpm install`, then `pnpm --filter @katakit/gallery dev` and open `/demos/bingo`, or run
`pnpm --filter @katakit/demo-bingo-react dev` for the standalone version.
Start local Moonshine Tiny streaming transcription with your microphone. The first use downloads a model. Audio
stays in the browser; the board and transcript reset on reload.
Finalized words are shown in Last heard as soon as a segment arrives; interim recognition text is not displayed or used for bingo.
Choose a word list. Built-in packs draw a mix of
familiar, less familiar, and wildcard entries; choose **Shuffle** for another draw.
Rare names and deliberately tricky words may be misheard by the recognizer; click
a square to correct it. Shuffling keeps matches from the current transcript.
You can switch lists or shuffle without stopping transcription; the new card
rechecks finalized turns and clears manual square corrections.
Built static hosting needs cross-origin isolation (COOP/COEP headers), as in the
transcription demo.

The browser host supplies finalized segments to `@katakit/transcript-ingestion`; a bingo plugin runtime effect follows its conversation turns. It uses `createMicrophoneTranscriber` from
[`@katakit/transcription`](../../pkgs/transcription/README.md); it does not load any Chrome extension APIs.
The extension demo includes its own copy of the [local Bingo plugin](src/bingo/README.md)
with a different audio host. Its implementation and tests live in `src/bingo/`;
there is no separate Bingo package to build or install. Run
`pnpm --filter @katakit/demo-bingo-react test:ci` to check the board and word lists.

The view binds only `lastHeard$` and the board with React-RxJS.
A `Subscribe` boundary owns those UI subscriptions and releases them on unmount;
the bingo plugin effect keeps matching independently. The host disposes its microphone on unmount.
See the [React integration guide](../../docs/pages/getting-started/react.md).

The browser example’s `src/bingo/` is the canonical Bingo source. After changing
it, copy that directory to `demos/bingo-extension/src/bingo/` and run
`pnpm bingo:check-copy`. Root lint and CI reject differences between the copies.

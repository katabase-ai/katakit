# Browser conversation bingo demo

Run `pnpm gallery:dev` and open `/demos/bingo`, or run
`pnpm --filter @katakit/demo-bingo-react dev` for the standalone version.
Start local Moonshine Tiny streaming transcription with your microphone. The first use downloads a model. Audio
stays in the browser; the board and transcript reset on reload.
Live words are previewed in Last heard; bingo squares only match finalized words.
Choose a word list. Built-in packs draw a mix of
familiar, less familiar, and wildcard entries; choose **Shuffle** for another draw.
Rare names and deliberately tricky words may be misheard by the recognizer; click
a square to correct it. Shuffling keeps matches from the current transcript.
You can switch lists or shuffle without stopping transcription; the new card
rechecks finalized turns and clears manual square corrections.
Built static hosting needs cross-origin isolation (COOP/COEP headers), as in the
transcription demo.

The browser host supplies finalized segments to `@katakit/transcription` and
passes its conversation turns to `@katakit/bingo`. It uses the microphone input
from `demos/transcription-react/`; it does not load any Chrome extension APIs.
The extension demo uses the same bingo plugin with a different audio host.

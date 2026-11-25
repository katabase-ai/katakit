# Migration: conversation bingo

> Spec: [Event-sourced conversation bingo](bingo-event-sourcing.spec.md)

1. **Replace Bingo's state writer.** In `examples/demos/bingo-react/src/bingo/plugin.ts`, validate commands before emission and project the three game events using core's built-in log. Fail on a second opening or a move without a game. `startGame` always records the actual card.
2. **Connect live input.** `src/bingo/createBingoSession.ts` adapts recognizer segments to transcript ingestion. Only finalized words in the pending turn are eligible; deduplicate segments and new square matches. Share the timer and host-triggered completion path in `pkgs/transcript-ingestion/src/plugin.ts`. Replay does not invoke these writers.
3. **Switch the runtime, not the board.** Keep the host sink stable across deals. Browser, `gallery/shared/BingoGalleryDemo.tsx`, and the Chrome panel read the current round's projections. In the extension, load settings before enabling input controls, order stored and live speech, and forget earlier segments on a new deal. Copy the canonical plugin directory to the extension for standalone distribution.
4. **Verify behavior and packaging.** Compare live state with pre-start reconstruction, assert the opening event and manual/spoken payloads, and exercise a restart with pending speech. Typecheck and test both demos. Check canonical copy parity, standalone packed builds, and integration with gallery capture. On a native platform, verify real microphone input, stopping, shuffling while listening, and extension reopen separately from the synthetic tests.

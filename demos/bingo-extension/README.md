# Conversation bingo extension demo

From the repository root run `pnpm --filter @katakit/demo-bingo-extension build`,
then load `demos/bingo-extension/dist/` at `chrome://extensions` (Developer mode,
Load unpacked). On a regular HTTP(S) browser meeting tab, open the extension's
side panel and click **Start listening**. The first use downloads Whisper Tiny
English; transcription runs in the extension, not on an application server.
Tab audio is played back to the speakers; a microphone permission prompt is
optional. If denied, bingo continues using tab audio only. Chrome 116+ is needed.

Squares match complete normalized phrases against finalized words in Katakit's
transcript turns. They do not use a semantic classifier. Click a square to
correct a mark. **Edit card** accepts exactly 24 newline-separated phrases;
the center is free. Board edits are stored in extension local storage, while
transcript history lasts for the browser session. Stop capture before reloading
the extension. Model download needs access to Hugging Face.

This demo uses the audio capture implementation from
`templates/chrome-extension/src/capture.ts`, the template's background and
worklet assets, and `@katakit/transcription` for turn assembly. Browser audio
and model setup stay in the host. No account or external bingo API is required.

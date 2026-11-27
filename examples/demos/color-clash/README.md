# Color clash

Say the ink color, not the word. The game runs locally in a browser using on-device speech recognition.

## Run independently

Use Node.js 24+ and pnpm 11.9.0. From the Katakit checkout:

```sh
pnpm examples:copy demos/color-clash /tmp/my-color-clash
cd /tmp/my-color-clash
pnpm install
pnpm dev
```

Or download this folder with `npx degit katabase-ai/katakit/examples/demos/color-clash color-clash`, then run `pnpm install` and `pnpm dev` there.
Open the URL printed by Vite. The first play downloads the English speech model; allow microphone access. Microphone audio and recognized text remain on your device. Replay starts a fresh round; leaving the page stops and releases capture.

Build and check with `pnpm build`, `pnpm tsc`, and `pnpm test:ci` in the standalone directory. From the repository root run `pnpm demos:copy-check color-clash` to check an installed external copy.

## Manual check

In a supported browser on localhost, grant microphone access and say the _ink_ color of a displayed word. Confirm the score increments, saying the written word does not count, the clock ends after 20 seconds, and Play again starts a clean round. Check cancel during download and microphone-permission recovery. The build and unit tests do not establish recognition quality or real microphone behavior.

Static hosting needs a secure, cross-origin-isolated context. Serve `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on documents and runtime assets; Vite configures these headers for local development and copies the worklet/WASM under `dist/transcription-assets/`.

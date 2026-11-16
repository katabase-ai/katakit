# Starters

Copy one directory under [`templates/`](https://github.com/katabase-ai/katakit/tree/main/templates), including its `vendor/` tarballs, and install from that copy. Each is a separate pnpm project, not part of the repository workspace. Until Katakit is published, the built package tarballs travel with the copy. The speech-model weights do **not**: client-side starters download a model on first use. Use Node.js 24+ and pnpm 11.9.0 unless a README says otherwise.

The intended path for React, Electron, Chrome extension, and Obsidian is **record audio → recognize speech locally → send finalized text to Katakit transcript ingestion → display conversation turns**. A copied build and a fake-segment test do not prove that the microphone, model, or platform UI works; new integration paths are still awaiting manual checks. A real model download requires internet access, but no paid speech account. The [MCP App](mcp-app.md) is **WIP**: it needs a separate local transcription server and does not yet have an audio path.

## Choose a platform

| Starter                                 | Audio source and recognizer                        | Current evidence                                                |
| --------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| [React web](react-web.md)               | Browser microphone, Moonshine Tiny                 | Copied build/unit test; new mic path needs a browser run        |
| [Electron](electron.md)                 | Desktop microphone, Moonshine Tiny                 | Copied build/unit test; new Electron mic path needs a run       |
| [Chrome extension](chrome-extension.md) | Tab and optional mic, Moonshine Tiny               | Copied build/unit test; unpacked recognition needs a Chrome run |
| [Obsidian](obsidian.md)                 | Short mic clip, Whisper Tiny                       | Copied build/unit test; new plugin needs a test-vault run       |
| [MCP App — WIP](mcp-app.md)             | No audio path yet; requires local companion server | Typed-text preview only; real chat host unverified              |

## From copy to your application

1. Follow that starter's README for the exact copy, install, build, run, permission, model-download and manual test steps. A root `pnpm install` does not install these independent projects.
2. Find the recognition callback, Katakit `ingestSegment` method, Stop/`flush`, and turn observable in its platform guide. Some hosts use a browser microphone helper; Chrome supplies PCM from an offscreen document; Obsidian transcribes a completed clip. Do not confuse provisional speech with finalized text.
3. Change one input, plugin, or display at a time. If adding persistence or a server, document where audio/text goes and who can access it. The client-side starters do not upload recordings to an application service.
4. Verify the **copied** project on its actual platform: first model load, a final turn, Stop/Start, denied microphone permission, close/reopen, and cleanup. A browser preview cannot stand in for an Obsidian, Chrome, Electron, or chat-host smoke test.

For reusable behavior, see the [transcription utility](../reference/transcription.md) and [transcript-ingestion plugin](../reference/plugins/transcript-ingestion.md). [Templates and applications](../concepts/templates.md) distinguishes a starter from a feature demo. The [contributor checklist](https://github.com/katabase-ai/katakit/blob/main/templates/README.md) describes the distribution and review contract.

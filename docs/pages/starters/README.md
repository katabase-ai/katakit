# Templates

Choose a copyable application starter for your platform. Each guide explains its input path, permissions, and current verification. The starter's README owns the exact install and run commands.

Copy one directory under [`examples/starters/`](https://github.com/katabase-ai/katakit/tree/main/examples/starters), including its `vendor/` tarballs, and install from that copy. Each is a separate pnpm project, not part of the repository workspace. Until Katakit is published, the built package tarballs travel with the copy. The speech-model weights do **not**: client-side starters download a model on first use. Use Node.js 24+ and pnpm 11.9.0 unless a README says otherwise.

The intended path for React, Electron, Chrome extension, and Obsidian is **record audio → recognize speech locally → send finalized text to Katakit transcript ingestion → display conversation turns**. React and Electron have documented live checks; Chrome has reported successful tab and microphone transcription with additional paths still unverified. Obsidian awaits a complete installed-plugin check. A copied build and a fake-segment test alone do not verify a platform integration. A real model download requires internet access, but no paid speech account. The [MCP App](mcp-app.md) is **WIP**: it needs a separate local transcription server and does not yet have an audio path.

## Choose a platform

| Starter                                 | Audio source and recognizer                        | Current evidence                                                                             |
| --------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [React web](react-web.md)               | Browser microphone, Moonshine Tiny                 | Copied build/unit test; mic path checked in Chrome 157                                       |
| [Electron](electron.md)                 | Desktop microphone, Moonshine Tiny                 | Copied build/unit test; mic path checked in Electron 35                                      |
| [Chrome extension](chrome-extension.md) | Tab and optional mic, Moonshine Tiny               | Tab and mic transcription reported in Chrome 157; further lifecycle/permission checks remain |
| [Obsidian](obsidian.md)                 | Short mic clip, Whisper Tiny                       | Copied build/unit test; new plugin needs a test-vault run                                    |
| [MCP App — WIP](mcp-app.md)             | No audio path yet; requires local companion server | Typed-text preview only; real chat host unverified                                           |

## From copy to your application

1. Follow that starter's README for the exact copy, install, build, run, permission, model-download and manual test steps. A root `pnpm install` does not install these independent projects.
2. Find the recognition callback, Katakit `ingestSegment` method, Stop/`flush`, and turn observable in its platform guide. Some hosts use a browser microphone helper; Chrome supplies PCM from an offscreen document; Obsidian transcribes a completed clip. Do not confuse provisional speech with finalized text.
3. Change one input, plugin, or display at a time. If adding persistence or a server, document where audio/text goes and who can access it. The client-side starters do not upload recordings to an application service.
4. Verify the **copied** project on its actual platform: first model load, a final turn, Stop/Start, denied microphone permission, close/reopen, and cleanup. A browser preview cannot stand in for an Obsidian, Chrome, Electron, or chat-host smoke test.

## Templates, applications, and demos

A **plugin** supplies reusable behavior, such as event history or conversation-turn grouping. An **application** connects plugins to its inputs, UI, storage, and external services. Its **platform** is the host it runs in, such as the browser, Electron, or Obsidian.

A **template**, called a starter in the repository, is a minimal copyable application for one platform. It includes assembly and host-specific setup. A **demo** is an application showing a user-facing capability and can contain more behavior than a starter. Templates live in `examples/starters/`; demos live in `examples/demos/`; reusable libraries live in `pkgs/`.

Platform permissions, audio capture, and UI belong to the application. The transcript-ingestion plugin accepts normalized text regardless of its source. A successful build verifies the code can compile; the platform guides separately record which real host interactions have been checked.

For reusable behavior, see the [transcription utility](../reference/transcription.md) and [transcript-ingestion plugin](../reference/plugins/transcript-ingestion.md). For a worked input-to-view path, continue the [Concepts walkthrough](../concepts/templates.md). The [contributor checklist](https://github.com/katabase-ai/katakit/blob/main/examples/starters/README.md) describes the distribution and review contract.

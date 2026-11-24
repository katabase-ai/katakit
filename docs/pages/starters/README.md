# Application starters

Start an application with Katakit using one of these copyable projects. Each starter connects platform-specific input to Katakit and displays the resulting conversation turns. Choose your platform below, then follow the starter's README to install and run it.

These starters recognize speech locally and pass finalized text to Katakit's transcript-ingestion plugin. Audio is processed on the device rather than uploaded to an application service. First use downloads speech-model weights and requires internet access, but no paid speech account.

## Choose a platform

| Starter | What it demonstrates |
| --- | --- |
| [React](react-web.md) | Browser microphone transcription with Moonshine Tiny, displaying provisional speech and completed turns in a React UI. |
| [Chrome extension](chrome-extension.md) | Tab and optional microphone transcription with Moonshine Tiny, displaying turns in a Chrome side panel. |
| [Electron](electron.md) | Microphone transcription with Moonshine Tiny, displaying provisional speech and completed turns in a desktop window. |
| [Obsidian](obsidian.md) | Recording a short microphone clip and transcribing it with Whisper Tiny after Stop, displaying turns in an Obsidian Desktop plugin view. |

React and Electron have live microphone checks. Chrome has live tab and microphone checks, but further lifecycle and permission checks remain. Obsidian is provisional: its complete installed-plugin path still needs a test-vault run, and mobile is unsupported. Follow each starter's README for tested versions, verification steps, and remaining limitations.

## From copy to your application

1. Choose a platform and copy its directory from [`examples/starters/`](https://github.com/katabase-ai/katakit/tree/main/examples/starters). Each starter is an independent pnpm project using Katakit packages from npm.
2. Follow the copied project's README for prerequisites and exact install, build, and run commands. Use Node.js 24+ and pnpm 11.9.0 unless that README says otherwise; a root repository install does not install the starters.
3. Use the platform guide to find where input, Katakit plugins, and UI connect. Adapt one part at a time, then run the README's checks on the target platform, including permissions and stopping the input. A successful build alone does not verify the live interaction.

## Starters, applications, and demos

A **starter** is a minimal application foundation with platform-specific setup, input, and UI. A **demo** shows a particular user-facing capability and may include more application behavior. Starters live in `examples/starters/`; demos live in `examples/demos/`.

For plugin architecture, see [Add a plugin and an effect](../concepts/plugins.md). For a worked input-to-view path, see [Connect an input and a view](../concepts/templates.md). The [contributor checklist](https://github.com/katabase-ai/katakit/blob/main/examples/starters/README.md) explains how to build and verify a new starter.

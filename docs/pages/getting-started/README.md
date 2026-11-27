# Quickstart

Give your coding agent an idea and a Katakit starter. The [React web starter](../starters/react-web.md) is a good first choice: it turns microphone speech into visible conversation turns, with recognition running locally in the browser.

Katakit is open source. Browse or clone the [source repository](https://github.com/katabase-ai/katakit) without signing in. The starters install published Katakit `0.1.0` packages from npm. Use Node.js 24+ and pnpm 11.9.0.

## Give this to your coding agent

Replace the bracketed fields, then copy this prompt into an agent that can read files and run commands on your computer. If you already have an application, describe it in the first line.

```text
Help me build [my app idea] with Katakit for [platform, or help me choose].
My project directory is [absolute path to a new or existing project].

1. Confirm the platform and whether this is a new or existing application.
   Recommend the React web starter for a first browser app.
2. Use an available Katakit checkout, or clone
   https://github.com/katabase-ai/katakit over public HTTPS.
   Read its AGENTS.md, CONTRIBUTING.md, and examples/README.md.
3. Read docs/pages/starters/README.md, the selected platform guide, and
   examples/starters/<platform>/README.md. Follow that README's current
   prerequisites and commands. Check whether its Katakit dependencies
   are published. If the network or dependencies are unavailable, pause
   setup and explain what is needed to continue.
4. For a new app, copy the complete starter into the new directory.
   For an existing app, inspect it first and propose the smallest
   integration that preserves its current behavior and my local edits.
5. Install, build, and test from the application's own directory.
   Start its development server and give me the local URL.
6. Follow the starter's manual platform checks. For React, help me allow
   microphone access, speak, confirm a visible conversation turn, and
   stop recording. Explain the first-use model download and data flow.
7. Make one small change toward my idea. Use Katakit's public package
   entry points and consult docs/pages/reference/ for their contracts.
   Re-run the relevant checks.

Report the files changed, commands and results, local URL, and any
microphone or platform checks that still need me to perform them.
```

The [starter guides](../starters/README.md) also cover Electron, Chrome extensions, Obsidian, and the WIP MCP App. Each starter's README owns its exact setup commands and platform requirements.

## Try the result

Once installation succeeds, open the React starter's local URL and choose **Start recording**. Allow microphone access and give the first model download time to finish. Speak a sentence, then choose **Stop recording**. You should see a conversation turn containing your words.

The starter keeps audio processing and transcript text on your computer. Model downloads contact the model provider and require internet access. Conversation turns stay in memory and disappear on reload. A passing build or automated test does not establish that your microphone works; try that path yourself.

## Keep building

Follow the [Tutorial](../concepts/README.md) to build a message list from events and learn how plugins fit together. Use [Reference](../reference/README.md) for package contracts, or [React-RxJS bindings](../reference/react.md#react-rxjs-bindings) to connect runtime observables to a React view.

For a new application, use [Designing event-sourced applications](../event-sourcing/designing.md)
to choose its event model. If an existing application currently keeps mutable state, follow
[Migrate an existing application](../event-sourcing/migration.md). The repository's
[`event-sourced-application` skill](https://github.com/katabase-ai/katakit/blob/main/.agents/skills/event-sourced-application/SKILL.md)
gives agents separate build and migration workflows with a design brief and replay checks.

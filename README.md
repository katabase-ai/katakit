# Katakit

> [!NOTE]
> <img src=".github/assets/seed.png" alt="A golden seed sprouting three green leaves" width="160" align="right" />
>
> This project is a seed.
>
> It contains a small sample of the experiments and prototypes we’ve been working on at [Katabase](https://katabase.com).
>
> There’s a lot more we’d love to share, and we’d appreciate your help shaping what comes next.
>
> - Request a [feature](https://github.com/katabase-ai/katakit/issues/new?template=feature_request.md), propose an [integration](https://github.com/katabase-ai/katakit/issues/new?template=integration_proposal.md), or report a [bug](https://github.com/katabase-ai/katakit/issues/new?template=bug_report.md)
> - Make a [contribution](CONTRIBUTING.md)
> - Get in touch with us [directly](mailto:katakit@katabase.com)
>
> We're excited to see what you build!
>
> \- The Katabase team (Abe, Jude, Drew)

---

Katakit is an open-source TypeScript developer kit for building voice-to-visual UI: interfaces
that take part in a conversation. Turn spoken words into something people can see, play with,
and shape together.

Compose typed plugins for live state, actions, and asynchronous work, independently of your UI
framework. Build around typed event history, connect speech recognition and conversation turns,
and add persistence through your own storage.

[Quickstart](https://katabase.com/docs) · [Demos](https://katabase.com/gallery) ·
[Starters](https://katabase.com/docs/starters) · [Documentation](https://katabase.com/docs/reference)

We're sharing an early collection of patterns and examples from our work on **voice-to-visual
interfaces**. The initial `0.1.0` packages are available on npm; the copyable demos and starters
install those packages directly.

## Why Katakit?

When people talk and AI participates visually, a conversation can become a shared outline,
diagram, or plan. Building that interaction means connecting changing inputs, application
behavior, and a responsive UI. Katakit gives you composable foundations for exploring it:

- **Compose behavior.** Combine plugins for your application's state, actions, and asynchronous work.
- **Connect your own inputs and UI.** Use speech, supplied text, or another source, and render the
  result in the interface that fits your application.
- **Keep history explicit.** Use validated events to drive application state, and add persistent
  storage when you need it.

Plugins expose RxJS **observables**, callable **methods**, and reactive **effects**. Applications
own their UI, input sources, model connections, and storage. The same runtime can support a
voice-driven interface, a chat interaction, or another responsive application.

Read [Why Katakit?](https://katabase.com/docs/why-katakit) for the motivation and the questions we're exploring.

## A small example

Record a message and observe it through the runtime's built-in event log:

```ts
import { EventLogPlugin, makeKatakit } from '@katakit/core';

const kit = makeKatakit({ plugins: [] }).start();
const { events$ } = kit.getObservables(EventLogPlugin);
const { emitEvent } = kit.getMethods(EventLogPlugin);

const subscription = events$.subscribe(event => {
  console.log(event.text);
});

emitEvent({ type: 'message', text: 'Let’s map the next steps.' });
console.log(events$.getAll().length); // 1

subscription.unsubscribe();
```

The subscription logs `Let’s map the next steps.`; the recorded message includes its sequence number and timestamp.
New subscribers receive recorded events before subsequent live events. Plugins can derive
application state from this history; saving it across visits requires a storage connection.

For live speech, connect the transcription utility's `onFinal`, `onProvisional`, and `onStop`
callbacks to the ingestion methods. The [React web starter](https://katabase.com/docs/starters/react-web)
includes recognition, model assets, microphone controls, UI, and cleanup. The
[conversation bingo demo](https://katabase.com/gallery/bingo) adds a custom plugin that turns recognized
phrases into changes on a game board.

## Try Katakit

- **Explore a demo:** open the [gallery](https://katabase.com/gallery) to try local transcription,
  conversation bingo, structured notes, and the [brainstorming game](examples/demos/brainstorm-react/README.md).
  Transcription runs locally; structured notes and open-ended answer judging use a model connection.
  Each example links to its source and setup.
- **Start an application:** copy the [React web starter](examples/starters/react-web/README.md),
  then follow its install and run instructions. First use downloads a speech model; no paid
  speech account is needed.

The [starter catalog](https://katabase.com/docs/starters) also covers Electron, Chrome extensions,
experimental Obsidian desktop integration, and a work-in-progress MCP App. Each guide records
platform setup, permissions, and current verification.

## Packages and plugins

| Package                                                                                           | Kind    | What it provides                                                                                               |
| ------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| [@katakit/core](https://katabase.com/docs/reference/core)                                         | Runtime | Typed plugin composition, effects, and reactive primitives.                                                    |
| [@katakit/transcript-ingestion](https://katabase.com/docs/reference/plugins/transcript-ingestion) | Plugin  | Finalized text segments grouped into observable conversation turns.                                            |
| [@katakit/persistence](https://katabase.com/docs/reference/plugins/persistence)                   | Plugin  | Batched event writes through your storage callback.                                                            |
| [@katakit/transcription](https://katabase.com/docs/reference/transcription)                       | Utility | Moonshine/Whisper recognition, browser microphone and PCM helpers, runtime assets, and an optional React hook. |

The transcription utility works independently of the plugin runtime. Add persistent storage
through your own adapter when you need events to survive a reload.
React applications render runtime observables with [React-RxJS](https://katabase.com/docs/reference/react#react-rxjs-bindings).

## Documentation

- [Quickstart](https://katabase.com/docs) — build from a starter with your coding agent.
- [Tutorial](https://katabase.com/docs/concepts) — build an event-driven message list, add a plugin, and save its history.
- [@katakit/react](https://katabase.com/docs/reference/react) — developer workbench availability, React-RxJS bindings, and microphone ownership.
- [Transcription](https://katabase.com/docs/reference/transcription) — configure recognition and its resources.
- [Reference](https://katabase.com/docs/reference) — explore the reusable building blocks and API guidance.

## Development and contributing

Use Node.js 24+ and pnpm 11.9.0. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm tsc
pnpm test:ci
pnpm build
```

See [Contributing](CONTRIBUTING.md) for ways to help, local setup, and submitting a pull request.
The [development reference](DEVELOPMENT.md) covers workspace conventions, checks, and previews.
Try an example, adapt it to something you care about, and share what you build or
where the pieces get in your way through [GitHub issues](https://github.com/katabase-ai/katakit/issues).

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

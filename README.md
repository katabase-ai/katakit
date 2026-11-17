# Katakit

Katakit is an open-source TypeScript developer kit for building voice-to-visual UI: interfaces
that take part in a conversation. Turn spoken words into something people can see, play with,
and shape together.

Compose typed plugins for live state, actions, and asynchronous work, independently of your UI
framework. Build around typed event history, connect speech recognition and conversation turns,
and add persistence through your own storage.

[Getting started](docs/pages/getting-started/README.md) · [Demos](examples/demos/gallery/README.md) ·
[Starters](docs/pages/starters/README.md) · [Documentation](docs/pages/reference/README.md)

We're sharing an early collection of patterns and examples from our work on **voice-to-visual
interfaces**. The packages are currently version `0.0.0` and unpublished; the copyable starters
include built Katakit packages so you can try them before a registry release.

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

Read [Why Katakit?](docs/pages/why-katakit.md) for the motivation and the questions we're exploring.

## A small example

Record a typed event and observe it through the runtime's replayable history. This example uses
supplied text so you can see the behavior without a microphone or model. It uses Valibot as its
synchronous Standard Schema validator:

```ts
import { makeKatakit } from '@katakit/core';
import { makeEventLogPlugin } from '@katakit/event-log';
import * as v from 'valibot';

const EventLog = makeEventLogPlugin({
  validateEvent: v.strictObject({
    type: v.literal('message'),
    text: v.string(),
  }),
});
const kit = makeKatakit({ plugins: [EventLog.configure({ initialEvents: [] })] }).start();
const { events$ } = kit.getObservables(EventLog);
const { emitEvent } = kit.getMethods(EventLog);

const subscription = events$.subscribe(event => {
  console.log(event.text);
});

emitEvent({ type: 'message', text: 'Let’s map the next steps.' });
console.log(events$.getAll().length); // 1

subscription.unsubscribe();
```

The subscription logs `Let’s map the next steps.`; the history contains one validated event.
New subscribers receive recorded events before subsequent live events. Plugins can derive
application state from this history; saving it across visits requires a storage connection.

For live speech, connect the transcription utility's `onFinal`, `onProvisional`, and `onStop`
callbacks to the ingestion methods. The [React web starter](examples/starters/react-web/README.md)
includes recognition, model assets, microphone controls, UI, and cleanup. The
[conversation bingo demo](examples/demos/bingo-react/README.md) adds a custom plugin that turns recognized
phrases into changes on a game board.

## Try Katakit

- **Explore a demo:** run the [gallery](examples/demos/gallery/README.md) to try local transcription,
  conversation bingo, and structured notes. Transcription runs locally; generating structured
  notes requires a host-supplied model connection. Each example links to its source and setup.
- **Start an application:** copy the [React web starter](examples/starters/react-web/README.md), including
  its `vendor/` directory, then follow its install and run instructions. First use downloads a
  speech model; no paid speech account is needed.

The [starter catalog](docs/pages/starters/README.md) also covers Electron, Chrome extensions,
experimental Obsidian desktop integration, and a work-in-progress MCP App. Each guide records
platform setup, permissions, and current verification.

## Packages and plugins

| Package                                                              | Kind    | What it provides                                                                                               |
| -------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| [@katakit/core](pkgs/core/README.md)                                 | Runtime | Typed plugin composition, effects, and reactive primitives.                                                    |
| [@katakit/transcript-ingestion](pkgs/transcript-ingestion/README.md) | Plugin  | Finalized text segments grouped into observable conversation turns.                                            |
| [@katakit/event-log](pkgs/event-log/README.md)                       | Plugin  | Validated live events and replayable in-memory history.                                                        |
| [@katakit/persistence](pkgs/persistence/README.md)                   | Plugin  | Batched event writes through your storage callback or browser local storage.                                   |
| [@katakit/transcription](pkgs/transcription/README.md)               | Utility | Moonshine/Whisper recognition, browser microphone and PCM helpers, runtime assets, and an optional React hook. |

The transcription utility works independently of the plugin runtime. Add persistent storage
through your own adapter when you need events to survive a reload.
React applications render runtime observables with [React-RxJS](docs/pages/getting-started/react.md).

## Documentation

- [Getting started](docs/pages/getting-started/README.md) — assemble your first runtime.
- [Concepts](docs/pages/concepts/README.md) — build an event-driven message list, add a plugin, and save its history.
- [React integration](docs/pages/getting-started/react.md) — render runtime state and connect speech.
- [Transcription](docs/pages/reference/transcription.md) — configure recognition and its resources.
- [Reference](docs/pages/reference/README.md) — explore the reusable building blocks and API guidance.

## Development and contributing

Use Node.js 24+ and pnpm 11.9.0. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm tsc
pnpm test:ci
pnpm build
```

See [Contributing](CONTRIBUTING.md) for workspace conventions, the complete checks, documentation,
and previews. Try an example, adapt it to something you care about, and share what you build or
where the pieces get in your way through [GitHub issues](https://github.com/katabase-ai/katakit/issues).

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

# Tutorial

Build a small message list to learn how Katakit's pieces work together. You'll record messages as events, derive the displayed list from that history, and add behavior that responds to new messages. Then you'll save the history and connect the same behavior to an interface.

Keeping the events lets you reconstruct the list instead of maintaining a separately editable copy. This is **event sourcing**. Katakit's event-log plugin keeps that history in memory; you choose how to store it across visits.

## Follow the walkthrough

1. [Start a runtime](runtime.md): configure an event log and emit a message.
2. [Derive state from events](event-history.md): turn the event stream into a list and rebuild it from history.
3. [Add a plugin and an effect](plugins.md): give the list a callable method and react to new messages.
4. [Restore and save history](persistence.md): validate stored events and append new ones.
5. [Connect an input and a view](templates.md): display the list and choose a platform starter.

Each page extends the same TypeScript example. Start with the package setup in [Getting started](../getting-started/README.md). You'll use `@katakit/core`, `@katakit/event-log`, `rxjs`, and `valibot`; the storage step also uses `@katakit/persistence` in a browser. Katakit packages are currently unpublished, so use built workspace packages or locally packed artifacts rather than assuming a registry install is available.

The walkthrough names the source files to create and shows the expected result after each step. Put them in the same directory in your TypeScript application. The first four steps print their results to the console; they need no microphone or model connection.

For a complete application you can copy and run immediately, choose a [platform template](../starters/README.md). For contracts and lifecycle details, use [Reference](../reference/README.md).

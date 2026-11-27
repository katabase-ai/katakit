# Tutorial

Build a small message list to learn how Katakit's pieces work together. You'll record messages as events, derive the displayed list from that history, and add behavior that responds to new messages. Then you'll save the history and connect the same behavior to an interface.

Keeping the events lets you reconstruct the list instead of maintaining a separately editable copy. This is **event sourcing**. Katakit's event-log plugin keeps that history in memory; you choose how to store it across visits.

This walkthrough builds a new feature. Next, use [Event Sourcing](../event-sourcing/README.md)
to design your own application, review its implementation, or migrate existing mutable state.

## Follow the walkthrough

1. [Start a runtime](runtime.md): configure an event log and emit a message.
2. [Derive state from events](event-history.md): turn the event stream into a list and rebuild it from history.
3. [Add a plugin and an effect](plugins.md): give the list a callable method and react to new messages.
4. [Restore and save history](persistence.md): validate stored events and append new ones.
5. [Connect an input and a view](templates.md): display the list and choose a platform starter.

Each page extends the same TypeScript example. Use matching event-sourcing versions of
core and persistence, plus RxJS and Valibot:

```sh
pnpm add @katakit/core @katakit/persistence rxjs valibot
```

For a complete platform application and an agent-guided setup, use [Quickstart](../getting-started/README.md).

The walkthrough names the source files to create and shows the expected result after each step. Put them in the same directory in your TypeScript application. The first four steps print their results to the console; they need no microphone or model connection.

For a complete application you can copy and run immediately, choose a [platform starter](../starters/README.md). For contracts and lifecycle details, use [Reference](../reference/README.md).

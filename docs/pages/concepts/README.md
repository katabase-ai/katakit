# Tutorial

Build a small message list to learn how Katakit's pieces work together. You'll record messages as events, derive the displayed list from that history, and add behavior that responds to new messages. Then you'll save the history and connect the same behavior to an interface.

Keeping the events lets you reconstruct the list instead of maintaining a separately editable copy. This is **event sourcing**. Katakit's event-log plugin keeps that history in memory; you choose how to store it across visits.

This walkthrough builds a new feature. Next, use
[Designing event-sourced applications](event-sourcing.md) to choose events, projections,
and session boundaries, and [Event-sourcing implementation standards](event-sourcing-in-practice.md)
to review the resulting code and replay tests. If you already have a mutable-state application, use
[Migrate an existing application](../getting-started/migrate-to-event-sourcing.md) for the cutover
and handling of existing saved data.

## Follow the walkthrough

1. [Start a runtime](runtime.md): configure an event log and emit a message.
2. [Derive state from events](event-history.md): turn the event stream into a list and rebuild it from history.
3. [Add a plugin and an effect](plugins.md): give the list a callable method and react to new messages.
4. [Restore and save history](persistence.md): validate stored events and append new ones.
5. [Connect an input and a view](templates.md): display the list and choose a platform starter.
6. [Designing event-sourced applications](event-sourcing.md): choose domain facts, session boundaries, and resource owners for your own feature.
7. [Event-sourcing implementation standards](event-sourcing-in-practice.md): review methods, projections, live effects, and replay tests.

The first five pages extend the same TypeScript example; the final two apply its ideas
to your own feature. Use matching event-sourcing versions of core and persistence, plus
RxJS and Valibot for the example:

```sh
pnpm add @katakit/core @katakit/persistence rxjs valibot
```

For a complete platform application and an agent-guided setup, use [Quickstart](../getting-started/README.md).

The walkthrough names the source files to create and shows the expected result after each step. Put them in the same directory in your TypeScript application. The first four steps print their results to the console; they need no microphone or model connection.

For a complete application you can copy and run immediately, choose a [platform starter](../starters/README.md). For contracts and lifecycle details, use [Reference](../reference/README.md).

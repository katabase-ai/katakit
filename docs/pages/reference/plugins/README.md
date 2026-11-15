# Plugins

These pages document the plugin factories available in this repository. Each page owns the plugin's configuration, observables, methods, dependencies, and lifecycle contract. The [plugin concept](../../concepts/plugins.md) explains the shared model; the [core reference](../core.md) describes `makeKatakitPlugin` itself.

- [Event log](event-log.md) — validated live events and replayable in-memory history.
- [Persistence](persistence.md) — append new events with host-owned storage or browser local storage.
- [Transcript ingestion](transcript-ingestion.md) — assemble finalized transcript segments into conversation turns.
- [Bingo](bingo.md) — match conversation turns against a playable bingo card.

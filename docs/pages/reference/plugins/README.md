# Plugins

A plugin supplies behavior that an application registers in a runtime. Its observables expose values, its methods accept calls, and its effects react to streams. See [Core](../core.md#makekatakitplugin) for the shared contract, or [add a plugin](../../concepts/plugins.md) for a walkthrough.

Each page below includes setup, configuration, observables, methods, and resource ownership:

- [@katakit/event-log](event-log.md) — validated live events and replayable in-memory history.
- [@katakit/persistence](persistence.md) — append new events with application-owned storage or browser local storage.
- [@katakit/transcript-ingestion](transcript-ingestion.md) — assemble finalized transcript segments into conversation turns.

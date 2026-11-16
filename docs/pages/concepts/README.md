# Concepts

Katakit separates a plugin's reactive state, callable methods, and effects. A runtime composes configured plugins and makes their outputs available to one another.

- [Runtime and lifecycle](runtime.md) explains construction, start, lookup, and current shutdown boundaries.
- [Plugins](plugins.md) explains the three parts of a plugin and how dependencies are resolved.
- [Templates and applications](templates.md) distinguishes plugins, applications, platforms, templates, and demos.
- [Event history](event-history.md) explains the event-log plugin's replay and validation behavior.
- [Persistence](persistence.md) explains the boundary between an event log and durable storage.

For exact exports and options, use the [reference](../reference/README.md). For a runnable application, choose a [starter](../starters/README.md).

# Event Sourcing

The [Tutorial](../concepts/README.md) builds a message list from recorded events.
Use this section to design an application around that model, review its implementation,
or migrate one that currently keeps mutable content in a store or component state.

1. [Designing event-sourced applications](designing.md): choose meaningful events,
   projections, session boundaries, and owners for live work.
2. [Event-sourcing implementation standards](implementation-standards.md): check
   content authority, deterministic replay, effects, and tests in the code.
3. [Migrate an existing application](migration.md): inventory existing writers,
   decide what happens to saved data, and cut over one feature at a time.

For the precise runtime and effect APIs, see the [core reference](../reference/core.md).

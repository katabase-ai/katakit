# Why Katakit?

What if AI could join a conversation and contribute to what people are making together—not just summarize it afterward? We call one family of these interfaces **smart whiteboards**: people talk, AI participates visually, and the group can shape a shared artifact as the conversation unfolds. The same ideas can also work alongside chat or other interfaces.

## The interaction is the hard part

A live conversation moves faster than a typical prompt-and-response workflow. People change direction, leave goals unstated, and sometimes disagree about what they are trying to make. An AI participant needs to keep up, understand enough of the group's intent to be useful, and know when to contribute without interrupting or taking over.

Then there are the engineering questions: where do events come from, how is state shared, and how do you connect a particular interface to the services it needs? The right answers will vary by application. We don't think every experiment should have to rebuild the same foundations first.

## A kit for experimenting

Katakit is an open-source dev kit for exploring these interactions. It composes plugins that expose state, methods, and effects. An application can connect those pieces to its own UI and inputs instead of inheriting a prescribed whiteboard or meeting app.

That separation matters when you want to try a different source of input, change how an interaction behaves, or build for another form factor. It leaves room to experiment without treating one prototype as the finished product.

## What’s here today

This is a seed, not a complete smart-whiteboard platform. The repository currently includes the [core runtime](reference/core.md), [plugins](reference/plugins/README.md) for event history, persistence, and transcription turns, React transcription and browser-bingo demos, a conversation-bingo extension demo, and [copyable platform starters](starters/README.md). Demos show user-facing capabilities; starters show smaller, platform-specific Katakit interactions. Some starters still need manual verification on their stated platforms.

Start with [Getting started](getting-started/README.md) to run the smallest example, then use the [Reference](reference/README.md) to see what each building block provides. The kit does not yet solve every problem of live collaboration, model choice, or evaluation.

## Build with us

We’re sharing these pieces early so others can try them, show us what they build, and tell us where the abstractions help or get in the way. If you’re exploring AI that joins people in making something together, we’d love to compare notes.

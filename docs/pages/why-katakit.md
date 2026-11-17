# Why Katakit?

What if AI could join a conversation and contribute to what people are making together? In
**voice-to-visual interfaces**, human speech is a primary input and AI participates visually.
People can create and refine a shared artifact—notes, a diagram, or a plan—as the conversation
unfolds. The same ideas can support a solo activity or blend with chat and other interfaces.

## The interaction is the hard part

A live conversation moves faster than a typical prompt-and-response workflow. People change direction, leave goals unstated, and sometimes disagree about what they are trying to make. An AI participant needs to keep up, understand enough of the group's intent to be useful, and know when to contribute without interrupting or taking over.

Then there are the engineering questions: where do events come from, how is state shared, and how do you connect a particular interface to the services it needs? The right answers will vary by application. We don't think every experiment should have to rebuild the same foundations first.

## A kit for experimenting

Katakit is an open-source TypeScript dev kit for exploring these interactions. It composes
plugins that expose observables, methods, and effects. Applications connect those pieces to
their own UI, inputs, model connections, and storage. The core runtime is independent of the
UI framework, and the speech-recognition utilities can also be used independently of the runtime.

That separation matters when you want to try a different source of input, change how an interaction behaves, or build for another form factor. It leaves room to experiment without treating one prototype as the finished product.

## What’s here today

We're sharing an early collection of patterns and examples. The repository includes the
[core runtime](reference/core.md), [plugins](reference/plugins/README.md) for event history,
persistence, and transcript turns, and independent [transcription utilities](reference/transcription.md).
Demos show local transcription, conversation bingo, and structured notes; notes generation
uses a host-supplied model connection. [Copyable platform starters](starters/README.md) show
smaller application integrations and record their current verification.

Start with [Getting started](getting-started/README.md) to run the smallest example, then use the [Reference](reference/README.md) to see what each building block provides. The kit does not yet solve every problem of live collaboration, model choice, or evaluation.

## Build with us

We’re sharing these pieces early so others can try them, show us what they build, and tell us where the abstractions help or get in the way. If you’re exploring AI that joins people in making something together, we’d love to compare notes.

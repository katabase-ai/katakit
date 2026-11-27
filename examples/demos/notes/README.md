# Structured notes

Turn on-device speech recognition into a two-level Markdown outline. Finalized turns trigger
model requests when a connection is configured; later speech can correct an existing note while
the original transcript remains intact. The example shows how to record accepted outlines and
restore them from events without calling the model again.

The standalone host owns microphone capture and local model transport. The gallery supplies
its own shared input and admitted connection. Audio stays on-device; finalized text is sent to
the configured model when listening.

See [AGENTS.md](AGENTS.md) for independent setup, model requirements, code organization,
embedding, hosting, and manual verification.

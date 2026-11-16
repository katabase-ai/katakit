# MCP App card — WIP

The [MCP App starter](https://github.com/katabase-ai/katakit/tree/main/templates/mcp-app) is **work in progress** and does **not** transcribe audio. Its current card adds typed sample notes to a Katakit-backed list in browser memory; a local browser preview and MCP stdio/resource tests exercise only that path. A real chat host has not rendered it in a manual test.

An audio version will need a separately started **local transcription server**, a permitted way for the chat host to supply audio, explicit server-access and privacy boundaries, and a real-host smoke test. Audio cannot be treated as processed entirely inside this card. Do not confuse its existing `server/mcp.ts`—which serves the card and tool metadata—with a speech-recognition server: it does not receive notes or audio and does no inference.

To explore the existing scaffold, follow the copied directory's [README](https://github.com/katabase-ai/katakit/blob/main/templates/mcp-app/README.md). `src/notes.ts` assembles Katakit; `src/card.ts` owns the local UI; `server/mcp.ts` registers the app resource. There is no recommended microphone or audio-upload path until it can be tested in a compatible host. This is **not** a complete transcription starter.

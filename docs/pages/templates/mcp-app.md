# Build an MCP App card

The [MCP App starter](https://github.com/katabase-ai/katakit/tree/main/templates/mcp-app) includes an interactive card and a local stdio MCP server. The card uses `@katakit/core` with a small template-owned Notes plugin: adding the supplied text updates a list in card memory. The server advertises a tool and serves the card HTML; it does **not** collect the notes. A local browser preview lets you try the interaction without a chat account, but previewing a browser page does not prove a chat host will render an MCP App.

## Try the local interaction

Copy the complete `templates/mcp-app/` directory and use its [README](https://github.com/katabase-ai/katakit/blob/main/templates/mcp-app/README.md) for installation, `pnpm dev`, build, preview, and test commands. In the browser preview, select **Add note** to submit the prefilled sample, then try whitespace for an error. The build produces `dist/index.html` and `dist/server.mjs`; the tests exercise the Katakit state change and MCP stdio/resource registration. No chat account, speech model, or cloud service is required for this local preview.

## Trace card versus server

1. `src/notes.ts` defines the Notes plugin, configures Katakit, and exposes `notes$`, `add`, and `close`. The `add` method trims and validates notes (1–160 characters) before updating in-memory state. Replace this plugin first when you want a different card behavior.
2. `src/card.ts` maps the form to `add`, subscribes to `notes$`, displays note text without interpreting it as HTML, and tears down the subscription and plugin. Outside localhost it connects the card to the MCP Apps host bridge. The card itself does not send note contents to the server.
3. `server/mcp.ts` registers `open_notes_card` and the card resource; `server/stdio.ts` starts the local server. The tool returns static instructions, not the user's notes. Changing this boundary to send data to tools or models requires an explicit privacy review.

For a real host, the README shows a sample Claude Desktop `mcpServers` configuration using absolute paths to the copied build. Chat hosts can require an account, approval, and their own connector setup. They may process what you type or display even though this example does not intentionally forward notes as MCP messages. **Do not enter confidential text in a chat-host test.** The browser preview stays local to the page, and notes disappear on close/reload.

## Limits and verification

**Provisional as an MCP App integration.** Local browser interaction was checked on macOS 15.6 with Node 24.14.1 and pnpm 11.9.0, but the browser engine/version was not exposed. A copied build, Katakit test, and MCP stdio test pass. Neither Claude Desktop nor ChatGPT has rendered this card in a manual test yet. Verify tool invocation, card rendering, note submission, error handling, and teardown in a compatible host before claiming that path works.

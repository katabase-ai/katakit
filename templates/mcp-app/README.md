# Katakit MCP App starter — WIP

**Work in progress:** this card does not transcribe audio. A working audio version needs a separately started local companion server to handle recognition and a verified way for the chat host to deliver audio to it. The current Notes plugin and vendored `@katakit/core` package demonstrate only a typed-text state change. The local browser preview does not prove an MCP App works in a real chat host. Do not present this as a completed transcription starter.

## Try the copied directory

Copy **this entire directory**, including `vendor/`, outside the Katakit repository. From inside the copy, with Node.js 24+ and pnpm 11:

```sh
pnpm install
pnpm dev
```

Open the URL printed by Vite (normally `http://127.0.0.1:5173`). Click **Add note** to add the prefilled sample. Try entering whitespace and submitting: the card should show a validation error instead of adding a note. Stop Vite with Ctrl+C. Run `pnpm build` to produce a single-file card at `dist/index.html` and a local stdio MCP server at `dist/server.mjs`; `pnpm preview` serves the built card for the same local browser check. Run `pnpm test` for the Katakit interaction and an MCP stdio/resource smoke test. No model or cloud service is required.

The `pnpm-workspace.yaml` in this directory isolates its dependencies from the original repository. `@katakit/core` is declared as `file:vendor/katakit-core-0.0.0.tgz`; all other dependencies come from the registry. This copied template includes the repository's Apache-2.0 `LICENSE`; the core tarball also contains its own `package/LICENSE` alongside compiled JS, types, README and manifest. It was built from Katakit commit `3dea321` with tsdown 0.22.14 and TypeScript 7.0.2; when the core source changes, rebuild and review the tarball before distributing the template. No other Katakit package is needed, so there are no local transitive overrides. When Katakit is published, replace the file dependency with its registry release.

## Try the card in a chat app (optional)

Chat platforms may require an account, installation, or additional approval. To try Claude Desktop, build the **copied** directory first, then add this server to your `mcpServers` configuration (use the actual absolute paths and the absolute path to your Node executable):

```json
{
  "mcpServers": {
    "katakit-notes": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/your-copy/dist/server.mjs"]
    }
  }
}
```

Restart Claude Desktop or reload its MCP configuration, start a new chat and ask it to call `open_notes_card`. Confirm the card renders and pressing **Add note** appends the sample; if only the tool's text appears, that is a host-rendering failure, not a Katakit-state failure. This chat-app rendering path has **not been manually verified** in this worktree. Other hosts, including ChatGPT, may require different connector or deployment arrangements; this template does not claim to have tested them. The local browser preview is the account-free basic path.

## Where to adapt it

- `src/notes.ts` assembles and starts Katakit, owns the in-memory Notes plugin, validates input, and exposes a `close` method. Replace this plugin first to show a different Katakit behavior.
- `src/card.ts` connects note state to the view, stops subscriptions on teardown, and connects to the MCP Apps host when running in a chat card. `index.html` and `src/style.css` are the UI.
- `server/mcp.ts` registers the tool and HTML resource; `server/stdio.ts` runs the server over local stdio. The MCP tool returns only static instructions, never note contents. No microphone, file-system, or network permission is requested by the card.

Notes exist only in card memory and vanish when the card closes or reloads; there is no recording, transcription, persistence, upload endpoint, or backend access to the note contents. npm/pnpm obtains installation dependencies from the registry. A chat host supplies the card's execution environment and may process what is displayed or typed there; **do not enter confidential notes unless you trust that host**. The template does not intentionally send note text in MCP messages or to the language model. Browser-preview text is never sent to a chat host. Input errors appear in the card's status line; connection failures are also shown there.

For the shared Katakit API, see the [Katakit reference docs](https://github.com/katabase-ai/katakit/tree/main/docs/pages/reference).

## Verification status

Automated: `pnpm test` checks the Katakit state change and the stdio MCP resource; from the Katakit repository, `pnpm templates:check` validates manifests and `pnpm templates:copy-check mcp-app` copies, installs, and builds outside the workspace. The latter validates packaging, **not** an actual chat host. Manual local browser interaction was tested on macOS 15.6 using Node 24.14.1 and pnpm 11.9.0 in the OpenChamber browser panel (browser version not exposed): the sample note appeared after submission, and whitespace produced the validation error. Claude Desktop/ChatGPT versions and real chat rendering remain unverified.

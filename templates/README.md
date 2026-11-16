# Building Katakit templates

A template is a small application starter for one platform, such as the web, Electron, Obsidian, or a browser extension. The React, Electron, Chrome, and Obsidian starters should **transcribe real audio into Katakit turns**, not just capture input or display typed text. The MCP App is WIP until it can hand audio to a separately started local companion server. Put reusable behavior in public packages; keep platform permissions, setup, input sources, and UI in the template. A demo can show more features and need not be a minimal starter. This README is for contributors building templates; for choosing and adapting one, start with [Starters](../docs/pages/starters/README.md). See [Templates and applications](../docs/pages/concepts/templates.md) for the distinction.

## Copyable directory

Place a template in its own directory under `templates/`. Someone should be able to copy that directory out of the repository, run `pnpm install`, and build it without relying on files elsewhere in the monorepo. Templates are **not** members of the root pnpm workspace: run pnpm from inside the template directory to use its own dependency overrides, even while the directory lives in this repository. Include a README and a copy of the template's LICENSE in that directory. Declare ordinary libraries and build tools in its own `package.json` with registry versions. Katakit packages are not yet published: include the built package tarballs your example needs under its own `vendor/` directory and declare them as `file:vendor/<package>.tgz` dependencies. If one Katakit package depends on another, include both tarballs and add local overrides in the template's `pnpm-workspace.yaml` so that transitive dependencies resolve from `vendor/`, too. Do not use `workspace:*`, links outside the copied directory, or files in the original monorepo. Include any configuration, assets, and platform files required by the basic path. Once Katakit packages are published, replace the local tarballs with registry versions. Until then, rebuild the tarballs from the same source revision whenever their source changes; document how they were produced and review the files shipped in the copy.

Make the Katakit setup and the connections to input, recognition, storage, and UI easy to find. Use the repo's TypeScript, formatting, linting, and test conventions where they fit, but do not force the same source layout or a `dev` command on every platform. Keep the basic example small: no provider account or paid service. For the four client-side starters, an explicitly documented first-run speech-model download is allowed; do not silently ship weights or claim offline first use. The MCP App is the exception requiring an external local server. Document its audio transfer and setup before claiming it works. Request only permissions the example uses; never ship credentials or log private audio or transcript content by default.

## Each template's README

Explain what someone can do **now**, what is experimental, and what has not been implemented. Include:

1. The target platform and versions actually tested, the Katakit packages used, and what the basic interaction demonstrates.
2. Prerequisites and exact install, build, and run steps **from the copied directory**. If commands differ inside the Katakit workspace, give those too.
3. Where Katakit is assembled and which files handle input, UI, permissions, storage, and shutdown. Say what to replace first when adapting the example.
4. Where user data is processed and stored, what leaves the device, which permissions or downloads occur, and how failures are shown. Distinguish recording from transcription; if a chat app receives text, say so.
5. How to run automated checks and a short manual test on the target platform, including at least one important failure path. Describe packaging or deployment steps and anything not yet verified.

Link to the [Katakit docs](../docs/pages/reference/README.md) for shared API behavior rather than duplicating an API reference in every README.

## Ready to list as a complete template?

- Copy the directory outside this repository, install and build it, then run its audio-to-Katakit interaction on the stated platform. Building alone does not prove recognition works.
- Run deterministic automated checks with fake finalized segments and without a live microphone, provider account, or model download. Document the manual **first model download, recording, final turn, Stop/Start, and permission failure** on the target platform; do not imply other app or OS versions were tested.
- Label controls, make them keyboard-operable where the platform permits, and show loading, permission, and error states honestly. Stop input sources and clean up resources when the example ends.
- Check that dependencies, licenses, bundled Katakit tarballs, user-data handling, and README claims match the code. Run the repository's `pnpm check` and `pnpm templates:copy-check` before integration; the latter copies each template outside the workspace, installs it, and builds it. To check one in development, run `pnpm templates:copy-check <directory-name>`.
- If any of these are missing, call it a **work-in-progress starter** and list the missing piece. The [starter guides](../docs/pages/starters/README.md) can still link to it without promising a verified platform integration.

Copy/install/build tests alone do not prove a UI runs on its target platform. The [starter guides](../docs/pages/starters/README.md) record which starters have a manual platform check and which remain provisional.

# Building Katakit templates

A template is a small application starter for one platform, such as the web, Electron, Obsidian, or a browser extension. Its basic path must **run Katakit**, not just capture input or display a UI. Put reusable behavior in public packages; keep platform permissions, setup, input sources, and UI in the template. A demo can show more features and need not be a minimal starter. See [Templates and applications](../docs/pages/concepts/templates.md) for the distinction.

## Copyable directory

Place a template in its own directory under `templates/`. Someone should be able to copy that directory out of the repository, run `pnpm install`, and build it without relying on files elsewhere in the monorepo. Declare the libraries and build tools it uses in its own `package.json` with ordinary installable versions, not `workspace:*`, `file:`, or `link:` dependencies. Include any configuration, assets, and platform files required by the basic path. The repository links local packages during development; a copied template must not depend on that link.

Make the Katakit setup and the connections to input, storage, and UI easy to find. Use the repo's TypeScript, formatting, linting, and test conventions where they fit, but do not force the same source layout or a `dev` command on every platform. Keep the basic example small: no provider account, paid service, separate local server, or first-run speech-model download. A platform's own install or permission steps are fine when documented. A speech model or service may be an optional extension with its downloads and data flow explained. Request only permissions the example uses; never ship credentials or log private audio or transcript content by default.

## Each template's README

Explain what someone can do **now**, what is experimental, and what has not been implemented. Include:

1. The target platform and versions actually tested, the Katakit packages used, and what the basic interaction demonstrates.
2. Prerequisites and exact install, build, and run steps **from the copied directory**. If commands differ inside the Katakit workspace, give those too.
3. Where Katakit is assembled and which files handle input, UI, permissions, storage, and shutdown. Say what to replace first when adapting the example.
4. Where user data is processed and stored, what leaves the device, which permissions or downloads occur, and how failures are shown. Distinguish recording from transcription; if a chat app receives text, say so.
5. How to run automated checks and a short manual test on the target platform, including at least one important failure path. Describe packaging or deployment steps and anything not yet verified.

Link to the [Katakit docs](../docs/pages/reference/README.md) for shared API behavior rather than duplicating an API reference in every README.

## Ready to list as a complete template?

- Copy the directory outside this repository, install and build it, then run its basic Katakit interaction on the stated platform. Building alone does not prove the application works.
- Run deterministic automated checks without a live microphone, provider account, or model download. Document the manual platform check and its tested version; do not imply other operating systems or app versions were tested.
- Label controls, make them keyboard-operable where the platform permits, and show loading, permission, and error states honestly. Stop input sources and clean up resources when the example ends.
- Check that dependencies, licenses, shipped assets, user-data handling, and README claims match the code. Run the repository's `pnpm check` and the standalone copy/build check before integration.
- If any of these are missing, call it a **work-in-progress starter** and list the missing piece. The [template catalog](../docs/pages/reference/templates/README.md) can still link to it without promising a complete Katakit application.

The current Chrome extension directory is work in progress: it captures audio but does not yet instantiate Katakit. The copy/build check verifies that its directory can stand alone; it does **not** promote the starter to a complete template.

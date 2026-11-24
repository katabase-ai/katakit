# Building application starters

A starter is a small application for one platform, such as the web, Electron, Obsidian, a browser extension, or a server host. Its basic interaction connects **real platform input → Katakit application behavior → an observable result**. Define that interaction before implementing it: the four current client starters transcribe audio into conversation turns, while another platform might ingest a service event and expose a projected result. A typed fixture or mock alone does not verify the real integration. Put reusable behavior in public packages; keep platform permissions, setup, input sources, and UI or service output in the starter. A demo can show more features and need not be minimal. This README is for contributors; for choosing a starter, start with [Application starters](../../docs/pages/starters/README.md). See [Starters, applications, and demos](../../docs/pages/starters/README.md#starters-applications-and-demos) for the distinction.

Use the [application-starter authoring skill](../../.agents/skills/application-starter/SKILL.md) with its [guide template](../../.agents/skills/application-starter/templates/guide.md) and [README template](../../.agents/skills/application-starter/templates/readme.md). This checklist remains the engineering authority; the templates organize its reader-facing material. The MCP App remains WIP and is not a reference implementation for new starters.

## Copyable directory

Place a template in its own directory under `examples/starters/`. The directory must contain its README, LICENSE, configuration, assets, and platform files. Declare registry versions for libraries and build tools in its `package.json`. Each template is an independent pnpm project; run its commands from that directory.

Make the Katakit setup and connections to input, storage, and UI or service output easy to find. Use the repo's TypeScript, formatting, linting, and test conventions where they fit, but do not force the same source layout or a `dev` command on every platform. Keep the basic interaction small. Prefer a local path without a paid service; if the platform inherently requires an account, credentials, or a companion service, document that requirement, any cost, and a deterministic automated test path. Do not describe a mocked path as live platform verification. Document first-run downloads rather than silently shipping model weights or claiming offline first use. Request only permissions the starter uses; never ship credentials or log private input by default.

Application content derives from `@katakit/event-log`; projections read it, while input handlers record events. Handles, cancellation, and provisional input can be transient with explicit owners. Document who stops, drains, cancels, unsubscribes, and releases resources. Server starters additionally identify request/session boundaries, credential ownership, admission, retention, and shutdown behavior. Do not imply that replay restarts external resources or that core supplies a general dispose API.

## Each template's README

Explain what someone can do **now**, what is experimental, and what has not been implemented. Include:

1. The target platform and versions actually tested, the Katakit packages used, and what the basic interaction demonstrates.
2. Prerequisites and exact install, build, and run steps **from the copied directory**. If commands differ inside the Katakit workspace, give those too.
3. Where Katakit is assembled and which files handle input, UI, permissions, storage, and shutdown. Say what to replace first when adapting the example.
4. Where user data is processed and stored, what leaves the device, which permissions or downloads occur, and how failures are shown. Distinguish recording from transcription; if a chat app receives text, say so.
5. How to run automated checks and a short manual test on the target platform, including at least one important failure path. Describe packaging or deployment steps and anything not yet verified.

Keep detailed verification evidence in a `Verification` section: date where known, OS/host versions, dependency source (npm or packed checkout libraries), scenarios, outcomes, and skipped checks. A guide summarizes consequential limitations and links here. Do not invent dates or turn a UI screenshot into proof of model, microphone, or server integration.

## Each starter's guide

Use an opening summary, then an explanation of the input-to-output path and relevant source files. Include an optional **Status and limitations** subsection in that opening overview only for consequential restrictions or verification gaps. Then use **Get started**, **Platform considerations**, **Make it yours**, and **Additional resources**, in that order. Exact commands belong in the copied README; guides explain how and why to adapt the project. External resources should be a short list of verified official links with a reason to use each.

Screenshots are optional: include one only when it explains something useful beyond the prose, rather than showing an empty/idle interface. Capture the actual application with sample data and enough host context to identify the platform. Keep images under `docs/public/starters/`, include alt text and a caption, record capture provenance and limits in the README, and never fabricate output or capture a personal vault/profile. Update navigation and affected links after retitling a guide.

Link to the [Katakit docs](../../docs/pages/reference/README.md) for shared API behavior rather than duplicating an API reference in every README.

## Ready to list as a complete template?

- Copy the directory outside this repository, install and build it, then run its defined platform-input-to-result interaction on the stated platform. Building alone does not prove the integration works.
- Run deterministic automated checks with controlled inputs, without live accounts, microphones, model downloads, or external service calls. Separately verify the real input, resulting application state/output, repeated use, shutdown/reopen, and a relevant failure path on the actual platform. For speech starters this includes first model download, recording, a final turn, Stop/Start, and denied permission. For server starters select equivalent checks such as authentication failure, duplicate input, cancellation, and session shutdown as applicable; do not imply untested hosts or versions work.
- Label controls, make them keyboard-operable where the platform permits, and show loading, permission, and error states honestly. Stop input sources and clean up resources when the example ends.
- Check that registry dependencies, licenses, user-data handling, and README claims match the code. Run the repository's `pnpm check` and `pnpm templates:copy-check` before integration; the latter copies each template outside the workspace, installs it against freshly packed local libraries, and builds it. To check one in development, run `pnpm templates:copy-check <directory-name>`.
- If any of these are missing, call it a **work-in-progress starter** and list the missing piece. The [starter guides](../../docs/pages/starters/README.md) can still link to it without promising a verified platform integration.

Copy/install/build tests alone do not prove a UI runs on its target platform. The [starter guides](../../docs/pages/starters/README.md) record which starters have a manual platform check and which remain provisional.

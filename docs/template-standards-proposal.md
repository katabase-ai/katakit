# Template standards proposal

**Status:** Discussion draft. This is not a maintained template specification or a claim that any prototype already complies. Refine it after comparing the first platform experiments.

## Purpose and boundaries

A Katakit template is a small, runnable starting point for a particular platform. A complete template assembles a Katakit application and shows how to run it there. A plugin supplies reusable, platform-independent behavior; a demo showcases a user-facing capability, even if it runs on the same platform. A template may contain an example interaction, but it should not become a product demo or a second implementation of shared behavior.

Place starters under `templates/<platform-purpose>/`, as projects separate from `pkgs/` and `demos/`. A work-in-progress starter can live there if its README and the [template catalog](pages/reference/templates/README.md) say exactly what is missing. The current Chrome extension starter captures audio but does not yet instantiate Katakit, so it is not a complete template. Do not call an experiment maintained merely because its build works.

## Proposed principles

Each principle answers a different question about a template. The detailed code and documentation rules below are ways to put these principles into practice, not additional principles.

1. **Show one working starting point.** What can someone run today? Give them a small, complete example for one platform, with one clear way to start it. A template should help someone begin their own app; it should not try to show every feature or every possible integration. Its basic example should need only the target platform and a small set of declared libraries, not a service account or separately downloaded speech model.
2. **Keep platform code out of shared plugins.** Which code belongs in the template? The template handles things specific to its environment, such as Electron windows, Obsidian vault access, microphone permissions, or a chat app's bridge. Shared packages handle reusable behavior: `@katakit/transcription` can recognize speech, while the separate `@katakit/transcript-ingestion` plugin groups finalized text into turns. The application connects these pieces without making a plugin depend on Electron or Obsidian APIs.
3. **Make it easy to change.** How will someone turn the starter into their own app? Keep the important connections—input, Katakit runtime, storage, and UI—easy to find. Show which parts to replace, rather than building a large configuration system for imagined needs. A desktop app and a browser extension need not have the same folder layout. Distribute each example by copying its directory; it should install and build outside this monorepo.
4. **Say plainly what happens to user data.** What does the starter actually do, and where does data go? Distinguish real features from placeholders and describe permissions, downloads, storage, network traffic, and sharing with a chat service. For example, recording audio is not the same as transcribing it, and a transcript shown in a chat card is shared with that service. Ask for only the permissions needed; do not ship secrets or log sensitive content by default.
5. **Only call it maintained when we can keep it working.** What can we verify and support? A maintained template needs a documented setup, automated checks, a manual check on the platform it targets, and an honest list of platform/version limitations. A promising experiment can remain a prototype until those checks and an owner exist.

## Code and architecture conventions

- Prefer TypeScript, the repo's Node/pnpm baseline, package-root imports (`@katakit/core`, etc.), and the existing formatter, linter, and test runner. Declare ordinary dependency versions and the build tools in each template so a copy can install outside the workspace; the workspace's `linkWorkspacePackages` setting supports local development without `workspace:*` dependencies in copied examples. Avoid new cross-repo conventions or aliases without a concrete platform need.
- Keep platform setup (permissions, lifecycle, platform APIs), input/storage connections, Katakit assembly, and UI easy to identify. These are responsibilities, not mandatory directory names. The examples do not need to communicate with one another.
- When assembling Katakit, keep runtime and source startup/teardown explicit. If using event-log persistence, load history before constructing the runtime; `start()` is once-only, and core currently has no general disposal lifecycle. Close/flush specific plugins as documented; do not imply their shutdown proves durable storage.
- Treat external input as untrusted: validate message shapes and origins, bound payload sizes where relevant, avoid leaking permissions through renderer or card bridges, and never put secrets in client bundles. Prefer narrow typed bridge methods over generic command execution.
- Separate provisional transcript updates from finalized segments; identify sources and finalized segment IDs stably. Speech recognition utilities live in `@katakit/transcription`; the optional `@katakit/transcript-ingestion` plugin groups supplied text into turns but does not capture audio, recognize speech, or save data. The application owns the connection between them.
- Keep failure paths visible: permission denied, source disconnected, model unavailable, or storage write failed should have understandable states. A fabricated transcript, success message, or progress percentage is worse than an explicit limitation.
- Write focused tests for runtime assembly, input/storage connections, lifecycle, and at least one manual check on the target platform. Automated tests should not require a live microphone, account, or model download. Keep optional integrations separate from the basic example.
- Include scripts for the operations the template actually supports (for example, `build`, `tsc`, and tests when present); do not require a `dev` server or empty test script for a platform that has no use for one. Ensure `pnpm check` remains green for repository-maintained templates. Explain any platform-specific checks that root CI cannot run.

## Documentation contract for each maintained template

The template's own README should answer, in this order:

1. **What it is:** platform, intended use, included packages, and a clear distinction between implemented and planned capabilities.
2. **Quick start:** prerequisites, exact commands from a copied directory and from the repo root where they differ, first-run steps, and how to verify success.
3. **Architecture:** concise map of entry points, runtime/plugin assembly, platform APIs, storage, and data flow.
4. **Data and permissions:** what is collected, where processing happens, what leaves the device or enters a chat service, persistence/retention, required permissions, and any user consent point.
5. **Configuration:** environment variables, optional services/models, assets and download sizes when material, and safe defaults; provide an example config without live secrets.
6. **Run and ship:** local development, tests, build, deployment or packaging, platform-specific setup, and limitations of the shipped artifact.
7. **Adaptation and troubleshooting:** what to replace first, known platform constraints, common failures, and links to relevant Katakit concepts/API docs rather than duplicated API reference.

The docs-site template catalog may list a work-in-progress starter if it labels its status and missing capabilities, as it does for Chrome today. Keep platform instructions in each template README, shared concepts in `docs/pages/concepts/`, and package behavior in `docs/pages/reference/`. Authored docs pages live under `docs/pages/`; package API signatures come from source JSDoc through the docs exporter. Adding a docs page requires regenerating navigation and passing `pnpm -F @katakit/docs check` and `pnpm -F @katakit/docs-export test:ci`.

## Promotion checklist (proposed)

Before labeling an experiment a maintained template, verify:

- A clean install and documented local start/build work when the directory is copied outside the monorepo.
- The example uses real Katakit package APIs, with platform-specific code outside library packages.
- All permissions, local/remote processing, storage, and external dependencies are disclosed accurately.
- A normal automated check and a documented manual check on the target platform cover the basic path and key failure states.
- The README and catalog agree on what works; platform/version restrictions are explicit.
- A maintainer and the tested platform versions are identified, or the artifact stays an experimental demo/prototype.

## Scope for this template push

- **Distribution:** copy the template directory. It must declare the libraries and build tools it uses and work outside the Katakit workspace. A generator or CLI is not needed now.
- **Dependencies:** the basic path should work without a paid service, account, separate local server, or downloading speech-model weights at first use. Declared libraries such as React or RxJS are fine. If the example needs an optional speech feature, keep that addition separate and explain its downloads and network access. The existing transcription utilities include WASM/runtime files in their package but download model weights from a provider on first use; those weights are what the earlier question called “model assets.”
- **Independence:** each template illustrates Katakit on its own platform. There is no requirement for the Electron, Obsidian, extension, and chat examples to talk to one another or to use one shared message format.
- **Platform testing:** name the platform and versions actually tested for each example. Do not imply macOS, Windows, mobile, or a chat app works merely because the code builds elsewhere.
- **Basic UI usability:** where an example has controls, label them, make them keyboard-operable, and show loading, error, and permission states. This is a baseline for a usable example, not a requirement to build a polished product interface.

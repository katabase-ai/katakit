# Authoring and hosting gallery demos

The gallery composes independently runnable feature examples into a shared browsing
experience. A single catalogue declares each demo's metadata and lazy loader; shared
hosting connects the selected demo to input and model services. This guide describes
how to add a demo while keeping its standalone application easy to read, copy, and modify.

## Ownership

Three layers have distinct responsibilities:

- **The example** owns its feature behavior, application state, components, local UI,
  and standalone entry point. Feature examples live under `examples/demos/` and use
  public Katakit packages. They do not import gallery or private website code.
- **The gallery** owns the catalogue, shared presentation, input ownership, and adapters
  that connect examples to those facilities. Portable modules live under `gallery/shared/`;
  the local host's bootstrap and routes live under `gallery/src/`.
- **The consuming host** chooses demos, supplies routing and model admission, and owns
  credentials, service URLs, account integration, policies, and publication. Protozoa
  consumes a pinned Katakit source revision and explicitly selects the demos it publishes.

Gallery-only wrappers belong in the gallery even when they wrap just one example.
The gallery can import example source; that dependency never runs in reverse. Its
standalone copy materializes imported demo sources and shared CSS as regular files.

## Declare a demo once

`gallery/shared/galleryDemoDetails.ts` is the authoritative catalogue. Each entry
declares a stable ID, title, description, source location, requirements, descriptive
tags, a navigation section, and a lazy loader. Independently runnable source directories also declare a
copy destination name for the gallery's local-running instructions.

Navigation groups selected demos into Basics, Games, and Meetings, in that order,
using each entry's `section`. Empty sections are omitted; the host's demo order is
preserved within each section. Welcome stays above the sections. Hosts can supply
`renderSectionLink` for linked section labels and `activeSection` to show an overview
of their selected demos. The local host uses `/sections/basics`, `/sections/games`,
and `/sections/meetings`. A separate disclosure button hides or shows each section's
demo links; that UI state lasts for the mounted gallery view.

The loader names its gallery-facing module directly. Reading metadata does not call
the loader. There is no component-name string registry or second manually maintained
list connecting metadata to components.

`gallery/shared/galleryDemos.tsx` derives renderable entries generically from the
catalogue, adapting each loader to React's lazy-component contract. It contains no
per-demo hosting branches. Named entries or an equivalent typed lookup let a host
select individual demos without duplicating their metadata.

Metadata remains readable during server rendering and before hydration. Importing
the catalogue does not execute browser-only demo modules, create runtimes, request
microphone access, download speech models, or start inference. Runtime creation
belongs to attachment, not module evaluation.

### Requirements and descriptive tags

`requiredCapabilities` is the single declaration of what a demo needs. It supplies
the facts used by the Operation Grid, missing-connection notices, local-running
instructions, and the shield badge's data-handling explanation. Do not maintain
separate `capabilities` and `dataHandling` declarations with overlapping meanings.

Keep these distinctions explicit when declaring requirements:

- Microphone capture, on-device transcription, and remote inference are different needs.
- A configured connection is not proof of permission, a downloaded model, valid
  credentials, or a reachable provider. Those checks happen when the visitor uses it.
- Data-handling copy describes the demo's behavior, not connection readiness or current
  network activity. It distinguishes local audio processing from text sent to a service.
  A remote-model requirement alone does not explain which data leaves the device.
- Host policy descriptions come from the host; a capability declaration does not
  establish a provider's retention or security guarantees.

Update the requirements and all their consumers together when a demo's data flow
changes. Keep requirements declarative rather than probing runtimes to discover them.

For example, a demo that sends recognized text to inference declares:

```ts
requiredCapabilities: {
  microphone: true,
  localTranscription: { audio: 'device' },
  remoteModel: { transcribedText: 'cloud' },
}
```

On-device demos omit `remoteModel`. `requiresGalleryCapability` checks requirements;
`galleryDataHandling` derives the privacy presentation from them. The derived value
is not another declaration in the catalogue. These types describe the gallery's
current microphone/text demos; new input or transport kinds extend the contract and
its notices together.

Tags describe the demo, for example `game`. They do not grant capabilities, select
transports, or determine privacy claims. Adding a tag does not require adding a
filtering interface or another configuration flag.

## Keep the component interface natural

Start with the example's standalone application. Its top-level component has a small,
understandable interface that lets the standalone entry point supply its own runtime
and controls. Shared component inputs express application concerns rather than
gallery context or private host services.

The gallery's common hosting wrapper connects ordinary examples to the existing
`GalleryDemo` attachment and readiness mechanism. It supplies the runtime, gallery
capture controls, and introduction visibility without repeating this wiring for
every entry. Standalone views retain their own introductions; gallery adapters
suppress them when the shared metadata header supplies that content.

`createGalleryDemo({ createRuntime, View })` accepts a view with ordinary `runtime`,
optional `controls`, and optional `showIntroduction` props. Examples satisfy this
interface structurally without importing a gallery type. The transcription adapter
adds its introduction through a small local view component.

Judge the interface by reading both entry points: can someone copying the example
understand and change it without learning the gallery? Do not add gallery-only
providers, imports, or configuration to an example merely to shorten registration.

Custom gallery adapters handle real differences while satisfying the same lazy-loader
contract:

- **Structured notes** connects host model admission and controls, and translates host
  failures into the example's own error type.
- **Transcription** supplies its additional introduction content.
- **Color Clash** coordinates capture with Play, Cancel, and round completion.

Keep these behaviors in their adapters rather than accumulating callbacks and flags
in the catalogue. Other demos follow the same ownership rule. The common interface
is a gallery hosting contract, not a general-purpose component registry.

## Preserve runtime ownership and cleanup

`GallerySpeechProvider` lives above navigation and owns shared speech resources.
Each demo visit acquires a deferred runtime lease. `GalleryDemo` reports readiness
after the lease settles; the shared loading frame uses that signal to reveal content.
Code loading and runtime readiness remain separate from microphone permission and
model-download feedback within the visible demo.

On navigation, the outgoing input sink remains attached while capture stops and drains.
Its final results are flushed before its runtime closes and the next runtime factory
runs. Pending attachments and starts are cancellable: leaving during setup cannot
later attach an abandoned demo or prompt for its microphone. Initialization failures
surface as errors rather than leaving the loading frame pending indefinitely.

The loaded speech model can survive navigation, but demo histories and application
state do not leak into the next visit. Each runtime owns its subscriptions, projections,
and transcript timers; its cleanup releases them explicitly. The host disposes its
shared input helper on root teardown. Model adapters cancel admission and in-flight
work on exit or connection invalidation according to the demo's existing contract.
Katakit core has no universal runtime disposal API; a shared wrapper does not invent one.

Keep application content derived from logged events. Resource handles, pending setup,
and display timing have explicit transient owners. Replaying history does not restart
capture, call a model, or reacquire resources. See [core’s built-in event log](../reference/core.md#built-in-event-log)
and [transcription ownership](../reference/transcription.md) for the underlying building blocks.

## Add or update a demo

1. Build the standalone example and its component interface first. Include its own
   dependencies, assets, setup instructions, and explicit resource cleanup.
2. Add a gallery-owned lazy module. Use common hosting for ordinary runtime/view
   wiring and a custom adapter for behavior that genuinely differs.
3. Declare metadata, `requiredCapabilities`, tags, and the loader once in the catalogue.
   Keep stable IDs stable. Supply a copy destination only for an independently runnable
   source directory.
4. Align the gallery's dependency manifest, source-copy inputs in
   `scripts/copy-example.mjs`, and narrow allowances in `scripts/check-structure.mjs`
   when adding imported sources or CSS.
5. Verify standalone and gallery consumption, including the lifecycle and metadata
   behavior below. Review a simple integration such as Bingo and a custom integration
   such as Notes or Color Clash when changing the common interface.
6. Have each consuming host explicitly adopt the source revision and select the entry
   for publication. Catalogue eligibility does not automatically publish a new demo.

The repository's gallery README owns exact local setup and host configuration commands.
Example READMEs provide independent install/run instructions or link to a local setup
guide. Bingo and transcription use standalone `AGENTS.md` files for setup and maintenance.
Shared registration
does not require identical standalone and embedded layouts; the embedded layout
contract is tracked separately in [issue #56](https://github.com/katabase-ai/katakit/issues/56).

## Verify every consumption path

For catalogue or hosting changes, check:

- **Metadata and loading:** server-rendered titles, descriptions, and requirement-based
  notices work before demo code loads. Browser-only modules remain lazy. Inspect build
  output for code splitting and unused-demo inclusion rather than assuming a mapped
  catalogue preserves tree shaking.
- **Runtime transitions:** navigation during setup, cancelled attachment, failures,
  retries, stop/drain ordering, final transcript delivery, and separate demo histories.
  Verify retained speech-model readiness without retained capture or inactive runtimes.
- **Demo behavior:** introduction visibility, Notes connection/error handling,
  transcription content, and game capture/round coordination. Preserve existing
  appearance and interactions when changing registration.
- **Independent copies:** install and build the affected examples and the complete
  gallery outside the workspace. Workspace resolution can hide missing files or
  dependencies. Use a real source copy to verify visitor-facing local-running commands.
- **Pinned hosts:** verify selected imports against the adopted source SHA, built
  library dependencies, and one React runtime. Keep source links and copy commands
  pinned to the revision visitors actually use. Gallery source changes alone do not
  require a library release.

Run these commands from the repository root, choosing the affected example in place
of `bingo-react`:

```sh
pnpm check
pnpm demos:copy-check bingo-react
pnpm gallery:copy-check
```

Controlled tests and copy builds do not establish live microphone behavior, provider
quality, or a consuming host's real admission and allowance handling. Exercise those
interactions in the appropriate host and report automated evidence separately from
manual checks and unavailable environments.

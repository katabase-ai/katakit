# Transcription packaging decision research (#61)

Status: **recommendation for human review, 2026-11-17; no production package split or API change**.
References [#61](https://github.com/katabase-ai/katakit/issues/61); does not close it.

## Question, baseline, and decision

How can a consumer install only its recognition runtimes, use independent capture and recognition
utilities in browsers or Node, and connect results to Katakit without acquiring unused engines or
making model downloads part of npm installation?

Recommend a small `@katakit/transcription` contract/orchestration/capture package, **two opt-in
provider packages carrying their respective browser runtimes**, and subpath exports within those
packages. Keep downloaded transcription weights outside the npm packages. Do not create a package
for every model size, a Node adapter merely by renaming browser code, or a model-selection service.
Provider adapters and their browser assets should initially version together. The names and APIs
below are proposals, not published packages or permission to implement this split.

The reason to split is the measured static payload, not import-time coupling: the existing neutral
import is already small. A provider split removes unused files from installation and deployment;
subpaths alone cannot do that. Retaining today's package while implementation is deferred remains
a viable short-term choice.

All Katakit source observations refer to fetched main
[`5efcb3134f1b014e15978ac7fb02e31e9400241e`](https://github.com/katabase-ai/katakit/tree/5efcb3134f1b014e15978ac7fb02e31e9400241e)
(2026-11-16, “Introduce Katakit and organize contributor documentation (#58)”). Experiments ran on
that revision in an isolated checkout. Paths below deliberately use that layout, preceding the
concurrent #45 → #46 → #47 reorganization. They are not claims about the latest layout after merging.
Libraries are unpublished `0.0.0` packages at this baseline; independent starters use local tarballs.

This research lives outside `docs/pages/` so unimplemented proposals do not appear as supported
consumer API documentation or generated navigation. The repository's documentation checks still
run; the report's own links and examples are checked separately.

## Constraints from the agreed architecture

The latest “Design Katakit transcription architecture” chat (local,
`01a1e567-22f5-79b2-b584-25c4f1c5ad99`, read 2026-11-17) culminated in the
[agreed spec posted to #61](https://github.com/katabase-ai/katakit/issues/61#issuecomment-6941971283).
Use that comment as the public contract authority rather than copying another competing spec here.

- Capture, PCM distribution, recognition, and provider normalization are independently usable
  utilities, with plain data and callbacks and no core/RxJS/ingestion dependency.
- Shared contracts include recording/source/run identity, timestamped `AudioFrame`, revisioned
  `SegmentUpdate`, scoped speaker labels, capabilities and lifecycle. Provider normalization owns
  line IDs, timing precision, byte-to-UTF-16 offsets and provider revisions. Participant mapping is
  application policy. These facts do not belong in a model registry inside ingestion.
- One event-log-backed ingester accepts multiple sources and retains overlapping turns and
  corrections. Official stateful plugins require an event log. Persistence remains optional.
- One source can feed independent recognizers. Conversation callbacks feed ingestion; diagnostic
  callbacks feed a separate collector. No automatic fallback, switching, or retranscription.
- Default voice-to-visual composition includes core, event-log and ingestion. Lower-level core,
  recognition, and capture remain independently available.

The [November 16 standup](https://notes.granola.ai/d/2222010d-2dc0-4d7d-893d-652e37bf054e)
was read from the complete local transcript `/private/tmp/2026-11-16-standup-transcript.txt`.
Relevant evidence: concurrent mic/tab inputs 44:57–45:18; utility/runtime separation and application
event ownership 45:34–47:28; diarization and remote/replay adapters 48:41–52:14; diagnostic recognition
52:49–53:20; wake activation outside the runtime 53:44–54:35. Packaging 59:32–63:09 raises runtime,
model-download, offline, and license questions and explicitly defers implementation. The claim that
browser and Node cannot share a package is a hypothesis; conditional exports permit this when
dependency and asset boundaries allow it. Audio-source transcript labels do not establish speakers.
Jude's [provider-package suggestion](https://github.com/katabase-ai/katakit/pull/28#discussion_r4584984399)
and [permission to defer](https://github.com/katabase-ai/katakit/pull/28#discussion_r4585165474)
are consistent with researching before changing production boundaries.

## What the existing package actually does

The pinned [manifest](https://github.com/katabase-ai/katakit/blob/5efcb3134f1b014e15978ac7fb02e31e9400241e/pkgs/transcription/package.json)
exports `.`, `/browser`, `/moonshine`, `/whisper`, `/react`, `/assets`, `/vite`, and `/package.json`.
It has **no required runtime dependencies**. React and Vite are optional peers. The provider SDKs are
development dependencies used to produce shipped assets; installing the packed library does not
install Transformers.js, Moonshine's npm SDK, ONNX Runtime Node, Sharp, React, or RxJS.

The [neutral orchestrator](https://github.com/katabase-ai/katakit/blob/5efcb3134f1b014e15978ac7fb02e31e9400241e/pkgs/transcription/src/index.ts)
accepts an injected engine and no browser globals. The
[browser factory](https://github.com/katabase-ai/katakit/blob/5efcb3134f1b014e15978ac7fb02e31e9400241e/pkgs/transcription/src/browserTranscriber.ts)
selects a packaged worker by model; the
[provider loader](https://github.com/katabase-ai/katakit/blob/5efcb3134f1b014e15978ac7fb02e31e9400241e/pkgs/transcription/src/providerEngine.ts)
loads Moonshine's sibling SDK files or Whisper's worker on demand. Importing or constructing does
not request a microphone or fetch weights. Provider entry points expose injected SDK/worker
transports; these are not equivalent to ready-made Node engines. In particular Whisper's factory
expects a DOM `Worker` interface and its declarations require DOM types.

[tsdown](https://github.com/katabase-ai/katakit/blob/5efcb3134f1b014e15978ac7fb02e31e9400241e/pkgs/transcription/tsdown.config.ts)
builds public JS/declarations;
[Vite](https://github.com/katabase-ai/katakit/blob/5efcb3134f1b014e15978ac7fb02e31e9400241e/pkgs/transcription/runtime.vite.config.ts)
bundles recognition workers, including Transformers.js and its browser ONNX backend.
The [copy script](https://github.com/katabase-ai/katakit/blob/5efcb3134f1b014e15978ac7fb02e31e9400241e/pkgs/transcription/scripts/copy-runtime-assets.mjs)
then copies every Moonshine `.js/.mjs/.wasm` sibling and all four ONNX `.wasm` files, plus notices.
That includes SDK surfaces beyond Katakit's speech adapter. Tree shaking the app cannot remove
those copied files. `pnpm pack` applies `publishConfig.exports`, removing workspace `source`
conditions, and includes built `dist`, README and the package license.

Ingestion currently has its own structural segment contract and no transcription-utility dependency;
see [its manifest](https://github.com/katabase-ai/katakit/blob/5efcb3134f1b014e15978ac7fb02e31e9400241e/pkgs/transcript-ingestion/package.json).
Its [implementation](https://github.com/katabase-ai/katakit/blob/5efcb3134f1b014e15978ac7fb02e31e9400241e/pkgs/transcript-ingestion/src/plugin.ts)
still has a single provisional/current-turn slot and optional event forwarding. The agreed
event-backed, revision-aware design is subsequent work, not behavior supplied by this PR.

## Method and reproducible experiments

Use Node 24+, pnpm 11.9.0 and the pinned lockfile. [experiment.mjs](experiment.mjs) only writes
temporary consumer fixtures, invokes the existing pack/build, and records small JSON measurements.
It removes temporary installations. It does not edit manifests, fetch transcription weights, or
implement proposed packages. [results.json](results.json) records file hashes, sizes, dependency
closures, model manifests and assertions. [upstream.json](upstream.json) records exact upstream
revisions, npm integrity values, and metadata retrieval commands. Units below are decimal bytes/MB,
not filesystem blocks or browser transfer compression.
Run the experiment from this research checkout while the transcription package, root build inputs,
and lockfile still match the pinned baseline. The script fails before packing if those tracked inputs
have changed; do not treat measurements from a newer package revision as reproducing these results.

```sh
pnpm install --frozen-lockfile
node docs/research/transcription-packaging/experiment.mjs /tmp/katakit-61-results.json
pnpm -F @katakit/transcription test:package
pnpm -F @katakit/transcription test:runtime
pnpm -F @katakit/transcription test:ci
```

The recorded host was macOS arm64, Node 24.14.1, pnpm 11.9.0, npm 11.11.0. The experiment packs
the actual library, installs that tarball with npm into a clean project without workspace aliases,
checks missing optional peers, executes a mock-engine lifecycle in Node and checks the real browser
factory's explicit unsupported-environment error there. It builds minimal retained base/browser
imports with Vite 6.4.6, with and without the real asset helper. It also installs two tiny local
optional dependency tarballs, both normally and with `--omit=optional`, to test package-manager
semantics separately from provider size.

| Measurement                                        |                 Result |
| -------------------------------------------------- | ---------------------: |
| Actual npm tarball, gzip                           |       17,706,898 bytes |
| Installed package, 55 regular files                |       53,209,350 bytes |
| Packaged runtime assets, 33 files                  |       53,144,882 bytes |
| Moonshine siblings, 25 files                       |       13,474,000 bytes |
| ONNX WASM variants, 4 files                        |       38,348,360 bytes |
| Bundled Whisper worker                             |        1,250,049 bytes |
| PCM recognition worker / capture worklet           |   10,659 / 1,076 bytes |
| Third-party notices                                |           60,738 bytes |
| Minimal neutral app JS, minified                   |            2,914 bytes |
| Minimal browser app JS, Whisper selected, minified |            9,025 bytes |
| Same browser build plus copied runtime assets      | 53,153,983 bytes total |

These are different costs: installing only the neutral import still installs the whole tarball;
importing the browser helper does not embed 53 MB into the app JS; adding its asset plugin places
all 53 MB in the static output, but a visitor only requests files the chosen engine loads. The
9 KB fixture without assets builds successfully but cannot run recognition until assets are served.
No first-use speech accuracy, latency, memory, or complete browser network trace was measured here.

The provider **development** dependency closure is 13,734,259 bytes for Moonshine 0.1.5 (one package),
and 250,576,543 bytes for Transformers.js 2.17.2 (81 installed packages, including optional packages).
This counts unique resolved package directories and regular file lengths, excluding nested
`node_modules` and symlinks; no unresolved dependency roots remain. Notable contributors are
ONNX Runtime Node 96,371,468 bytes, ONNX Runtime Web 68,172,947, Transformers.js 46,618,273 and Sharp
23,736,291. These are this host's existing installed build dependencies, including native artifacts,
not universal fresh-install sizes or end-consumer costs. Publishing unbundled SDK dependencies
would move much of that coupling to consumers. The current browser build excludes Sharp and
ONNX Runtime Node using Transformers.js's browser map.

Both tiny optional packages installed by default; `--omit=optional` omitted both. Optional peers
React/Vite did not install with the real tarball. Thus optional dependencies are not a selective
“install my chosen provider” mechanism, and an optional peer requires consumers to install and
version the SDK themselves. Neither setting makes already copied WASM files disappear.

### Runtime code and model weights are separate deliveries

Moonshine's installed SDK exposes model manifests from the shipped WASM. The experiment reads
`sttDependencies('en', arch, false)` without constructing a recognizer or downloading files:

| Current Katakit model             | Manifest model files | Declared bytes fetched separately |
| --------------------------------- | -------------------: | --------------------------------: |
| Moonshine Tiny (arch 2)           |                    7 |                        51,441,771 |
| Moonshine Small (arch 4, default) |                    7 |                       165,489,086 |
| Moonshine Medium (arch 5)         |                    7 |                       304,690,919 |

The manifest pins `quantized_26_07_30` CDN paths and gives sizes/checksums. These files are not in
Katakit's tarball. The engine WASM does embed VAD, so “no models in WASM” would be inaccurate.
That small embedded prerequisite is different from the selected transcription weights.

For Whisper, the pinned Hub tree metadata reports 10,124,913 bytes of quantized encoder ONNX and
30,727,382 of merged decoder ONNX at model revision
`79fb389fc764e7c395bd330e9531d9d32ada7049`, **40,852,295 bytes plus tokenizer/configuration files**.
This is metadata, not a measured cold-download total. Current Katakit requests
`Xenova/whisper-tiny.en` with `quantized: true`, without pinning a model revision; a future first
load can change independently of npm. It disables local-model lookup, uses single-thread inference,
and points ONNX at the copied local WASM; see
[the worker](https://github.com/katabase-ai/katakit/blob/5efcb3134f1b014e15978ac7fb02e31e9400241e/pkgs/transcription/src/whisperWorker.ts).

Moonshine's pinned SDK uses `download.moonshine.ai` and URL-keyed Cache API entries
(`moonshine-models-v1`), skipping caching when unavailable. Transformers.js enables browser Cache
API where available and filesystem caching in Node; its
[versioned configuration docs](https://huggingface.co/docs/transformers.js/v2.17.2/en/api/env)
describe local model roots, cache directories and disabling remote models. Browser caches may be
evicted. Neither provider's first-use cache is an offline distribution guarantee. WASM is executable
engine code, not a reason Node weights must ship through npm or download on every run.

## Realistic arrangements

| Arrangement                                                | npm installation                                                                        | App bundle and deployment                                                                | Consumer tradeoff                                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Current single package + subpaths                          | All 53.2 MB, no required SDK deps                                                       | Small app JS; helper copies all assets                                                   | Simplest migration; pays unused static payload                                          |
| Same package + provider-filtered asset helpers             | Same full install                                                                       | Can serve only selected runtime after implementing complete file manifests               | Good incremental deployment fix; no npm size saving                                     |
| Lightweight common package + provider packages with assets | Common + selected provider only                                                         | App imports selected adapter; copy only its runtime and shared capture files             | Recommended; more release/compatibility work                                            |
| One adapter package + separate runtime-only packages       | Common + adapter + runtime selected explicitly                                          | Same byte saving if versions match                                                       | Extra version pairing/setup; useful only with independent runtime release/hosting needs |
| Common package with optional SDK dependencies              | Both attempted by default; omit flag drops both                                         | Consumer bundler/browser-map and WASM setup needed unless prebuilt separately            | Easy missing-runtime failures; does not solve granular install                          |
| Common package with optional SDK peers                     | SDK omitted until app installs it                                                       | App must bundle SDK and copy its matching assets                                         | Smaller Katakit archive, higher integration burden/native dependency exposure           |
| Runtime CDN or model-weight npm packages                   | CDN shifts runtime bytes to first load; weight packages add selected weights to install | CDN needs version/CSP/origin handling; weight package supports explicit offline assembly | Optional future delivery modes; unsuitable as mandatory default                         |

All viable browser variants still fetch selected weights later unless the app deliberately stages
them. All require a worker/worklet/WASM URL strategy. Subpath or conditional exports select code;
they do not select which tarball bytes or transitive dependencies npm installs. Node officially
supports [subpath and conditional exports](https://nodejs.org/api/packages.html#conditional-exports),
so a package may contain separate `/browser` and `/node` implementations. Separate packages become
useful when the dependencies or distributed assets are large and independently optional. npm's
[optional dependency rules](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#optionaldependencies)
and the fixture agree on default installation and omission behavior.

## Recommended proposed structure

| Proposed surface                                               | Contents / dependency boundary                                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `@katakit/transcription`                                       | Plain contracts, errors, lifecycle orchestration; no model SDK, core, RxJS or React runtime dependency                               |
| `@katakit/transcription/browser`                               | Independent capture/distribution utilities and engine-injected microphone convenience; browser types isolated here                   |
| `@katakit/transcription/react`                                 | Optional React peer; utility ownership only, no provider imports                                                                     |
| `@katakit/transcription/assets`, `/vite`                       | Tiny shared worklet copy/serve helpers; Node/build-tool imports isolated from browser exports                                        |
| `@katakit/transcription-moonshine/browser`, `/assets`, `/vite` | Moonshine adapter/metadata and matching SDK/WASM/worker siblings, notices; depends on lightweight transcription                      |
| `@katakit/transcription-whisper/browser`, `/assets`, `/vite`   | Whisper adapter/metadata and bundled Transformers browser worker + matching ONNX WASM, notices; depends on lightweight transcription |
| Future provider `/node` or separate Node provider package      | Implement only after a tested Node engine/transport and offline model policy exist                                                   |
| Proposed `@katakit/transcript-ingestion/voice`                 | `makeVoiceApp` composition from the agreed spec; core + required event-log + ingestion, no capture/model/provider dependency         |

Do not expose an empty provider root implying automatic host selection. Explicit `/browser` imports
keep capabilities honest in Node-like renderers and SSR. Retain advanced injected adapter exports
where useful, with their actual host-specific types. Keep one shared contract authority under
transcription (a `/contracts` type-only re-export is optional); do not create another contracts-only
package before an independent versioning need exists. Ingestion may consume these types with an
erased type-only import and retain structural compatibility; no recognition code should enter the
plugin's runtime graph. If declaration consumers must resolve that package, declare the lightweight
package dependency rather than leaving unresolved imports. Provider capability metadata reports
implemented behavior; a neutral union catalog and implicit provider selector leave the common
package. Apps wanting both providers deliberately install both and combine their metadata.

The estimated selected-provider asset content is roughly 13.5 MB for Moonshine or 39.6 MB for
Whisper from the current groups, plus common code/notices. These are **partitions of measured
assets, not built split-package tarballs**. The current PCM worker imports the mixed provider
dispatcher, so a production split must rebuild dedicated workers and recalculate manifests;
copying these file groups is not proof of a complete split. Consider reducing ONNX variants only
after testing target-browser SIMD/fallback coverage. Keeping adapter and runtime together avoids
application-managed SDK/WASM compatibility. A separate runtime package is a future optimization,
not a prerequisite.

For the voice composition, prefer the ingestion `/voice` subpath initially because it already
owns the transcript behavior and depends on core; the required log is part of the agreed design.
A separate convenience package is equally feasible when discoverability or a broader application
composition warrants another publish unit. Review must settle the placement/name; neither exists
today. The convenience factory supplies the default event schema, validates restored history and
exposes plugin handles exactly as the spec describes. Custom event unions retain explicit
composition. Recognition users never need this convenience export or the event log.

## Installation and use

### Supported baseline (local tarballs, current API)

Build/pack the library; install the resulting archive into a separate application. The research
fixture performs this installation and lifecycle check. Replace `PATH_TO_ARCHIVE` with the pack
output path; do not try to install unpublished `0.0.0` from the registry.

```sh
pnpm -F @katakit/transcription pack --pack-destination /tmp
# In the consuming application:
npm install /tmp/katakit-transcription-0.0.0.tgz
```

```js
import { createTranscriber } from '@katakit/transcription';

// Host supplies a compatible engine; no browser or event log required.
const speech = createTranscriber({
  engine: async events => ({
    start() {},
    write() {},
    stop() {
      events.onFinal({ id: '1', sourceId: 'node', text: 'done' });
    },
    close() {},
  }),
  onFinal: console.log,
});
await speech.start({ sourceId: 'node' });
await speech.stop();
await speech.dispose();
```

For today's browser API use `createBrowserTranscriber({ model: 'whisper-tiny', onFinal })` from
`@katakit/transcription/browser`, with `transcriptionAssetsPlugin()` from its `/vite` export or
`copyTranscriptionAssets()` from `/assets`. See the pinned
[setup README](https://github.com/katabase-ai/katakit/blob/5efcb3134f1b014e15978ac7fb02e31e9400241e/pkgs/transcription/README.md).

### Proposed future packages and API (not installable today)

```sh
# Illustrative registry commands after an approved implementation and publication:
pnpm add @katakit/transcription @katakit/transcription-moonshine
# Only for diagnostics using a second engine:
pnpm add @katakit/transcription-whisper
# Only for a Katakit voice application (not standalone recognition):
pnpm add @katakit/core @katakit/event-log @katakit/transcript-ingestion
```

Proposed Vite configuration: each provider helper knows its own complete manifest; shared capture
assets have their own helper. All mount names below are illustrative app-controlled directories.

```ts
import { defineConfig } from 'vite';
import { transcriptionAssetsPlugin } from '@katakit/transcription/vite';
import { moonshineAssetsPlugin } from '@katakit/transcription-moonshine/vite';

export default defineConfig({
  plugins: [
    transcriptionAssetsPlugin({ assetsPath: 'speech/common' }),
    moonshineAssetsPlugin({ assetsPath: 'speech/moonshine', isolate: true }),
  ],
});
```

Proposed PCM wiring below uses the agreed `AudioSource`/run/update contract. The host has acquired a
source and established its recording clock/origin before starting recognition. This is not a
model-switching pipeline. The complete checked example is [proposal-example.ts](proposal-example.ts).

```ts
import { createTranscriber } from '@katakit/transcription';
import { createMoonshineEngine } from '@katakit/transcription-moonshine/browser';

const primary = createTranscriber({
  engine: createMoonshineEngine({ model: 'small', assetsBaseUrl: '/speech/moonshine/' }),
  onUpdate: update => ingest.ingestSegment(update),
  onStop: end => ingest.endRun(end),
});
await primary.start(run); // run includes recordingId, sourceId, runId and audioOriginMs
const subscription = source.subscribe(frame => primary.write(frame));
await source.start();
// Later: drain capture, then recognition, then release each owner.
await source.stop();
subscription.unsubscribe();
await primary.stop();
await primary.dispose();
await source.dispose();
```

Mic and tab have distinct sources/runs and call the same ingestion methods. A diagnostic Whisper
instance gets a distinct run ID and callback `onUpdate: update => comparison.record(update)`.
Use independent source subscriptions so a thrown write cannot suppress the other destination;
the source contract isolates subscriber exceptions. Applications explicitly attach participant
identity before ingestion. No provider or convenience package imports diagnostics by default.
The proposed example typechecks against clearly declared proposal signatures in
[proposal-api.d.ts](proposal-api.d.ts), **not implemented modules**; this verifies type consistency,
not provider execution.

## Browser assets and host obligations

Today the [Vite helper](https://github.com/katabase-ai/katakit/blob/5efcb3134f1b014e15978ac7fb02e31e9400241e/pkgs/transcription/src/vite.ts)
serves `/transcription-assets/` in dev and copies it into client build output. Runtime asset
responses include isolation/CORP headers; `isolate: true` additionally sets document headers in
dev/preview. It does not configure production hosting or download weights. The existing runtime
check passed all 33 assets, JS/WASM MIME types, nested `/nested/` base URL handling, isolation
opt-in and production copying. A gallery with separate server/client outputs explicitly copies to
the client tree; preserve that special case.

Production websites must serve JS modules as JavaScript and WASM as `application/wasm`, preserve
SDK/WASM sibling paths, and use a worker-loadable URL. Prefer same-origin assets and versioned
directories deployed atomically with app JS. Moonshine's current threaded runtime needs shared
memory/cross-origin isolation on websites: HTTPS/localhost, COOP `same-origin`, COEP `require-corp`.
Whisper is single-threaded and works without document isolation. CSP must allow the selected
workers, WASM execution and model endpoints. A CDN changes CORS/CORP/CSP requirements and may
need blob-worker allowances; a subpath export cannot fix those policies. ONNX's
[deployment guide](https://onnxruntime.ai/docs/tutorials/web/deploy.html) covers its separate JS/WASM
asset delivery. Keep the deployed files matched to the worker build.

For non-Vite builds use explicit copy helpers with app-owned destinations, or provider asset
manifests. Proposed split helpers copy common + selected provider; installing a provider alone
still does not make HTTP files available. A custom `assetsBaseUrl` points to engine code only.
It does not redirect model weights. Use the app base URL for subdirectory deployments and configure
the same path in copy/serve and runtime options. Do not upload static WASM as SSR Worker modules.

To support self-hosted/offline weights, follow-up adapters must expose a separate model location /
loader policy (pinned model revision/manifest, local bytes or URLs, explicit remote permission and
cache ownership). Moonshine's SDK already supports caller-supplied files/downloaders, but Katakit's
current narrow `loadSdk` facade still invokes its catalog load. Whisper's current packaged worker
hardcodes remote model loading. Neither public browser helper presently exposes a complete offline
model configuration. An app can customize an advanced injected SDK/worker today, but that is not
a documented turnkey offline recipe. Offline deployment should stage selected weights at build or
installer time and verify cold-cache execution with networking disabled; no npm postinstall
download or package per weight variant is necessary.

## Node, desktop, and consumer migration

| Consumer at the pinned revision                   | Actual behavior and implications                                                                                                                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser demos, including transcription-only React | Model catalog and helpers come from common `/browser`; update imports to selected providers and app-combined metadata; keep React optional                                                |
| Gallery                                           | Explicit client asset copy in `demos/gallery/vite.config.ts`; its SSR bundle must not import build-tool helpers at runtime                                                                |
| Chrome starter / extension bingo                  | Host owns mic/tab permissions and offscreen capture; preserve extension shared-memory exception and extension CSP instead of forcing website headers                                      |
| Electron starter                                  | Browser inference in sandboxed renderer on secure `katakit://app`, headers supplied by main; not Node/main-process recognition                                                            |
| Obsidian starter                                  | Bypasses the transcription package and directly bundles Transformers.js, patches backend selection, records then infers after Stop; splitting packages alone does not repair or verify it |
| MCP starter                                       | Companion audio path is WIP; no basis to advertise built-in Node recognition                                                                                                              |
| Headless Node / remote text app                   | Neutral orchestrator with injected engine, or callbacks straight into ingestion; no browser assets needed at execution, though today's tarball still installs them                        |

Pinned examples: [gallery configuration](https://github.com/katabase-ai/katakit/blob/5efcb3134f1b014e15978ac7fb02e31e9400241e/demos/gallery/vite.config.ts),
[Chrome capture](https://github.com/katabase-ai/katakit/blob/5efcb3134f1b014e15978ac7fb02e31e9400241e/templates/chrome-extension/src/capture.ts),
[Electron README](https://github.com/katabase-ai/katakit/blob/5efcb3134f1b014e15978ac7fb02e31e9400241e/templates/electron/README.md),
[Obsidian build](https://github.com/katabase-ai/katakit/blob/5efcb3134f1b014e15978ac7fb02e31e9400241e/templates/obsidian/build.mjs),
and [starter boundaries](https://github.com/katabase-ai/katakit/blob/5efcb3134f1b014e15978ac7fb02e31e9400241e/templates/README.md).
Their documented manual verification limits still apply; this research did not rerun those UIs.

Transformers.js 2.17.2 [supports Node inference](https://huggingface.co/docs/transformers.js/v2.17.2/en/tutorials/node),
but its actual backend imports both ONNX implementations and selects Node via `process.release.name`.
The browser map removes Node-native dependencies only when a browser build honors it. A Node
adapter must deliberately own execution isolation, accepted PCM/drain semantics, native binary/ABI
support and persistent writable model storage. `worker_threads` is not the DOM Worker API. A
future `/node` subpath can share provider logic, but if it makes native dependencies install for
browser consumers, use a separate opt-in Node distribution or explicit peer instead. Do not
assume `onnxruntime-node` is required by a headless app that only injects a remote engine.

Migration must explicitly separate the new revisioned callback contract from physical relocation.
Current `onFinal`/string `onProvisional`, session-relative timing and overloaded `sourceId` need a
documented breaking migration to `onUpdate`, recording/source/run identity and revisions. Keep
temporary compatibility wrappers in a deliberately full legacy package or time-boxed old release;
re-exporting both providers from the new lightweight root would erase install savings. Update
demo imports, Vite setup, default selections, React ownership and all standalone vendor archives
and transitive overrides together from one revision. Do not use workspace-only resolution as proof
that the copied starters work. Coordinate paths after #45–#47; no edits to their worktrees here.

## Redistribution constraints

Katakit's Apache-2.0 manifest does not relicense bundled upstream code. The current copier generates
`THIRD_PARTY_NOTICES.txt`, walking browser-relevant dependency license files while excluding
browser-disabled Sharp/Node ONNX. Transformers.js is Apache-2.0; ONNX Runtime is MIT; the pinned
Moonshine npm manifest declares MIT, and
[its source license at npm gitHead](https://github.com/moonshine-ai/moonshine/blob/234f60faa0eb388b01cdf7e60aca232af37aefda/LICENSE)
covers code except third-party components and defaults streaming/English models to MIT. It
separately lists legacy non-English non-streaming exceptions and TTS/G2P terms. The current
[Whisper model card](https://huggingface.co/Xenova/whisper-tiny.en/blob/79fb389fc764e7c395bd330e9531d9d32ada7049/README.md)
declares Apache-2.0. Those observations do not establish terms for every future provider/model.

A concrete gap: Moonshine 0.1.5's npm tarball has no root LICENSE/NOTICE file, and the generated
Katakit notices contain only its name/version/SPDX/repository, without the Moonshine copyright
and permission text. Its compiled WASM also incorporates third-party code beyond the npm
dependency graph. Before further runtime redistribution, copy verified upstream license/notice
text and audit the WASM build's third-party inventory, including the embedded VAD. Splitting the
package does not solve that. Preserve Apache/MIT notices with redistributed runtime files and
model artifacts. If staging weights, record each exact model artifact's origin, revision, checksum
and applicable terms. Repository `licenses:check` checks Katakit package license copies, not this
third-party inventory. This PR records the gap; it changes no license assertions or shipped assets.

## Follow-up implementation and remaining decisions

1. Approve/revise this recommendation and convenience-export placement. Keep #61 open until human
   review resolves the physical boundary and priority; this PR is research only.
2. Implement the agreed contracts/ingestion semantics in their own scoped work. Require an event
   log for official stateful plugins and preserve independent utilities, retained overlap and
   callback destinations. No model-switching infrastructure.
3. If approved, build a lightweight common package and provider packages, rebuild dedicated
   workers, add complete provider asset manifests/copy helpers, and include verified notices.
   Re-run packed consumer/type/browser/runtime checks and report real split-package sizes.
4. Migrate browser examples and independent starter tarballs after #45–#47 settle, including SSR
   client assets, nested base URLs, extension CSP/shared memory and renderer backend selection.
5. Add explicit model-source/offline configuration separately from runtime asset URLs. Decide
   reproducible revision pinning/update policy, cache eviction/error UX and installer staging.
6. Scope Node support to a concrete consumer/OS/backend before choosing `/node` versus another
   distribution. Test actual inference, filesystem caches and no-network startup then.

Open decisions: package naming/release cadence; compatibility window for old browser convenience
imports; exact common-worklet/provider-helper ergonomics; supported ONNX WASM fallback matrix;
Node platforms and backend; whether an offline artifact/installer merits optional weight packages.
No size benefit has been measured for actually rebuilt split packages. A filtered copier can be
an interim improvement if full splitting is deferred, but is follow-up production work as well.

## Validation and limits

The experiment's packed install, Node lifecycle/environment checks, three Vite builds, complete
dependency traversal and optional-dependency fixtures passed. Existing `test:package` passed Node
imports and TypeScript with bundler/nodenext resolution, including DOM-free base declarations;
`test:runtime` passed asset serving/copying; all 40 transcription unit tests passed. The build emits
the existing ONNX `eval` warning. No code or weights were sent to a recognition service.

Run [validate.mjs](validate.mjs) for proposal typechecking and this report's local links and pinned
GitHub paths. It checks source paths against the local baseline commit rather than relying on
moving main. `pnpm -F @katakit/docs check`, `pnpm -F @katakit/docs-export test:ci`, `pnpm docs:export`,
and the scoped formatter/linter checks were also run for this artifact. No public nav entry is
added because this directory is not a consumer guide.

Measurements are specific to the lockfile, build tool versions and host. SDK metadata/source can
resolve different questions from actual inference. Upstream references are pinned where possible;
general Node/npm/ONNX documentation was consulted 2026-11-17. No new ASR accuracy benchmark,
browser cold-cache speech run, Node provider inference, mobile run, CDN integration, or complete
compiled-runtime license audit is claimed. Model metadata sizes exclude transport headers,
compression, tokenizer/configuration overhead where stated, and cache eviction/retries.

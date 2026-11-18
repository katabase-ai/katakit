# Recognition utilities

The base API owns a recognizer session and accepts caller-supplied PCM. Browser capture,
provider engines, asset setup, Vite integration, and React ownership have separate entry points.

- Keep base recognition independent of Katakit plugins, event logs, React, and DOM globals.
  Use shared callback contracts so applications can connect another sink or plugin.
- Keep optional browser/React/Vite imports behind their own subpaths. A microphone
  ownership hook is not a replacement for React-RxJS observable bindings.
- Preserve stop/drain before sink close, idempotent disposal, and cancellation during
  loading. Report failures through the documented error contract.
- Do not silently bundle model weights or claim offline first use. Document downloads,
  worker/WASM assets, licenses, production headers, and host/runtime assumptions.
- Provider/runtime package splitting is deferred design work. Before splitting, establish
  actual download/asset costs and consumer requirements; separate subpaths alone do not
  establish independently installable provider packages.
- For exports/assets changes run `test:package` and `test:runtime` after building, plus
  focused tests. Mocked engines and asset checks do not verify recognition quality.

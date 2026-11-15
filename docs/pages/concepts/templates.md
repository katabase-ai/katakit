# Templates and hosts

Katakit's headless runtime can be assembled by different hosts. A **plugin** supplies reusable behavior—such as an event log or transcription—without prescribing an application shell. A **template** is a runnable starting point for one form factor, such as a web app, Electron app, or browser extension. It owns that host's bootstrap, permissions, assets, storage wiring, and deployment or packaging setup.

Templates may include plugins, but they are not plugins or runtime dependencies. Their code belongs beside `pkgs/`, not inside a library package. A **demo** instead showcases a user-facing capability in a concrete host. A demo can use plugins and borrow host patterns from a template, but a demo is not itself a minimal starter.

Host-specific requirements do not belong in core. For example, an audio source may need browser microphone permission or a server webhook, while the transcription plugin accepts normalized text independent of that source. See the [plugin catalog](../reference/plugins/README.md) for reusable behavior and the [template catalog](../reference/templates/README.md) for available starters.

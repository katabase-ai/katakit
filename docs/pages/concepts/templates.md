# Templates and applications

A **plugin** supplies reusable behavior—such as an event log or transcription—without prescribing an application shell. An **application** assembles plugins into a Katakit instance and connects them to its inputs, UI, and storage. The application runs on a **platform**, such as the web, Electron, or a browser extension.

A **template** is a runnable starting point that shows how to build a Katakit application for one platform. It includes the plugin assembly and the platform-specific setup needed to run it, such as permissions, assets, and packaging. Work-in-progress starters may provide only some of that setup; until they run a Katakit application, they are not complete templates. Template code belongs beside `pkgs/`, not inside a library package.

A **demo** is an application built to show a user-facing capability, not a minimal starting point. It may borrow from a template. Platform-specific requirements belong in the application, not core: for example, it may need browser microphone permission or a server webhook, while the transcript ingestion plugin accepts normalized text independent of its source. See the [plugin catalog](../reference/plugins/README.md) for reusable behavior and the [template catalog](../reference/templates/README.md) for starters and their current status.

## What to expect from a template

Copy its directory into a new project, install its declared libraries, and follow its README to run one small Katakit interaction on the stated platform. The basic example should not require a paid service, a separate server, or a speech-model download. Platform requirements—such as installing an extension in Chrome or a plugin in Obsidian—still apply. If an optional feature needs model weights or a service, the README should say when and why.

Templates need not share the same UI, source layout, or way of exchanging data. Their common purpose is to make the Katakit setup visible and easy to replace. Before describing a starter as complete, verify that it actually instantiates Katakit; a working audio-capture experiment alone is not a complete Katakit template. The [template catalog](../reference/templates/README.md) labels starters that are still in progress.

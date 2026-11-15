# Templates and applications

A **plugin** supplies reusable behavior—such as an event log or transcription—without prescribing an application shell. An **application** assembles plugins into a Katakit instance and connects them to its inputs, UI, and storage. The application runs on a **platform**, such as the web, Electron, or a browser extension.

A **template** is a runnable starting point that shows how to build a Katakit application for one platform. It includes the plugin assembly and the platform-specific setup needed to run it, such as permissions, assets, and packaging. Work-in-progress starters may provide only some of that setup; until they run a Katakit application, they are not complete templates. Template code belongs beside `pkgs/`, not inside a library package.

A **demo** is an application built to show a user-facing capability, not a minimal starting point. It may borrow from a template. Platform-specific requirements belong in the application, not core: for example, it may need browser microphone permission or a server webhook, while the transcript ingestion plugin accepts normalized text independent of its source. See the [plugin catalog](../reference/plugins/README.md) for reusable behavior and the [template catalog](../reference/templates/README.md) for starters and their current status.

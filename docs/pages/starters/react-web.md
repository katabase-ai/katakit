# Build a React web app

The [React web starter](https://github.com/katabase-ai/katakit/tree/main/templates/react-web) is the shortest path from a text form to a Katakit event log. It uses React 19 for the view, Valibot for event validation, and `@katakit/core` with `@katakit/event-log` for state. Adding text emits a validated event and displays the log; it does not generate a reply. The event history lives in browser memory and disappears on reload.

## Run and observe

Copy the whole `templates/react-web/` directory, including `vendor/`. Follow its [README](https://github.com/katabase-ai/katakit/blob/main/templates/react-web/README.md) to install, build, test, and start Vite from inside the copy. Open the local URL, enter `Hello Katakit`, and select **Add text**: it appears under Events. Submit only spaces to see the inline error without an event. Reload the page to see the empty log again. No microphone, account, model, or separate backend is involved.

## Trace the interaction

1. `src/katakit.ts` defines a strict `{ type: 'text', text }` schema, configures the event-log plugin with empty initial events, and starts Katakit. `emitText` calls the plugin method; `events$` exposes the replayable stream. For validation rules and replay behavior, see [Event log](../reference/plugins/event-log.md).
2. `src/main.tsx` trims the form value, rejects empty text, calls `emitText`, and subscribes to `events$` to update React state. The subscription is released when the component unmounts. The view renders the text as React content, not HTML.
3. `index.html` mounts the React application; `src/style.css` is local presentation. Vite emits static assets in `dist/` for hosting, with no application server required at runtime.

To adapt it, change the schema and emitted event in `src/katakit.ts` together, then replace the form/output in `src/main.tsx`. For example, add a `category` field to the schema and form before changing event history into something more elaborate. To keep history across reloads, add an explicit storage integration and document its retention; the current template does not save anything. [React integration](../getting-started/react.md) covers the broader framework boundary.

## Limits and verification

The local browser interaction was checked on macOS 15.6, but the browser panel did not expose its engine/version; other browser versions and accessibility behavior are unverified. A copied-directory install/build and a deterministic event-log test pass, but there is no automated UI test. Browser text stays in memory and application code does not send it to a provider; dependency installation still contacts the package registry. Verify deployment and user-data behavior again if you add storage or network calls.

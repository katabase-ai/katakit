# Transcription utilities

`@katakit/transcription` provides Moonshine and Whisper recognition independently of React,
RxJS, and the Katakit plugin system. React applications can use the optional
`useMicrophoneTranscriber` hook from `@katakit/transcription/react`. Browser applications can use its microphone helper;
applications with their own PCM source can use `createBrowserTranscriber` or supply an engine
to the base `createTranscriber` API. The [transcript ingestion plugin](plugins/transcript-ingestion.md)
can optionally group final segments into turns.

## Browser quick start

Install `@katakit/transcription`. With Vite, serve and copy its packaged runtime assets:

```ts
import { defineConfig } from 'vite';
import { transcriptionAssetsPlugin } from '@katakit/transcription/vite';

export default defineConfig({ plugins: [transcriptionAssetsPlugin({ isolate: true })] });
```

`isolate: true` sets COOP/COEP headers in development and preview for Moonshine. Omit it
for Whisper-only applications or when your host configures those headers itself. Production
Moonshine hosting must also set COOP/COEP; model weights are downloaded on first use.

```ts
import { createMicrophoneTranscriber } from '@katakit/transcription/browser';

const input = createMicrophoneTranscriber({
  model: 'moonshine-small',
  onFinal: segment => console.log(segment),
});
await input.start(); // From a user action.
// Later: await input.stop(); await input.dispose();
```

In React, `useMicrophoneTranscriber` owns the transcriber and the object it writes to for a
component's lifetime, and closes that object only after capture has drained:

```tsx
import { useMicrophoneTranscriber } from '@katakit/transcription/react';

const microphone = useMicrophoneTranscriber({ createSink: createTranscript });
// microphone.sink, .state, .level, .listening, .busy, .toggle()
```

See the [package guide](https://github.com/katabase-ai/katakit/blob/main/pkgs/transcription/README.md)
for model capabilities, PCM and custom-engine examples, lifecycle and error handling,
non-Vite asset setup, production hosting, and application support boundaries.

# Changelog

## 0.2.0

- **Breaking change in `@katakit/transcription/react`:** `useMicrophoneTranscriber` no longer takes `createSink` or returns `sink` and `level`. Pass the returned transcriber to `useMicrophoneTranscriberCallbacks` for utterance and lifecycle handlers, and to `useMicrophoneLevel` for meter updates.
- Share the transcriber across components with `MicrophoneTranscriberContext`.

## 0.1.0

- Initial release of callback-based PCM and browser microphone transcription using Moonshine and Whisper.
- Ship worker, AudioWorklet, and WASM assets with copying and Vite integration helpers.
- Provide an optional React microphone hook and explicit loading, start, stop, and disposal APIs.
- Download model weights on first use; weights are not bundled.

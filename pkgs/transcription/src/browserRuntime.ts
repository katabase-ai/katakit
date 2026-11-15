import type { TranscriptionModelId } from './catalog';
import { TranscriptionError } from './errors';

export const defaultTranscriptionAssetsBaseUrl = '/transcription-assets/';

/** Browser globals are accessed only when an operation starts, so imports are SSR-safe. */
export const checkBrowserSupport = (model: TranscriptionModelId, microphone = false) => {
  if (typeof WebAssembly === 'undefined' || typeof Worker === 'undefined')
    throw new TranscriptionError(
      'unsupported-environment',
      'Speech recognition requires WebAssembly and Web Workers. Use a browser runtime or supply an engine to createTranscriber.'
    );
  if (model.startsWith('moonshine-') && !globalThis.crossOriginIsolated)
    throw new TranscriptionError(
      'cross-origin-isolation-required',
      'Moonshine requires cross-origin isolation. Serve the document with Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp. For local development and preview, use transcriptionAssetsPlugin({ isolate: true }).'
    );
  if (
    microphone &&
    (!globalThis.isSecureContext ||
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof AudioContext === 'undefined' ||
      typeof AudioWorkletNode === 'undefined')
  )
    throw new TranscriptionError(
      'unsupported-environment',
      'Microphone transcription requires HTTPS or localhost, microphone permission, AudioContext, and AudioWorklet support.'
    );
};

export const transcriptionAssetUrl = (base: string, file: string) => {
  const documentUrl =
    typeof document !== 'undefined' ? document.baseURI : globalThis.location?.href;
  if (!documentUrl)
    throw new TranscriptionError(
      'unsupported-environment',
      'A browser document or worker URL is required to resolve speech assets.'
    );
  return new URL(file, new URL(base.endsWith('/') ? base : `${base}/`, documentUrl)).href;
};

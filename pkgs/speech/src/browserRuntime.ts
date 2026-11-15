import type { SpeechModelId } from './catalog';
import { SpeechError } from './errors';

export const defaultSpeechAssetsBaseUrl = '/speech-assets/';

/** Browser globals are accessed only when an operation starts, so imports are SSR-safe. */
export const checkBrowserSupport = (model: SpeechModelId, microphone = false) => {
  if (typeof WebAssembly === 'undefined' || typeof Worker === 'undefined')
    throw new SpeechError(
      'unsupported-environment',
      'Speech recognition requires WebAssembly and Web Workers. Use a browser runtime or supply an engine to createTranscriber.'
    );
  if (model.startsWith('moonshine-') && !globalThis.crossOriginIsolated)
    throw new SpeechError(
      'cross-origin-isolation-required',
      'Moonshine requires cross-origin isolation. Serve the document with Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp. The speechAssetsPlugin configures local development and preview.'
    );
  if (
    microphone &&
    (!globalThis.isSecureContext ||
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof AudioContext === 'undefined' ||
      typeof AudioWorkletNode === 'undefined')
  )
    throw new SpeechError(
      'unsupported-environment',
      'Microphone transcription requires HTTPS or localhost, microphone permission, AudioContext, and AudioWorklet support.'
    );
};

export const speechAssetUrl = (base: string, file: string) => {
  const documentUrl =
    typeof document !== 'undefined' ? document.baseURI : globalThis.location?.href;
  if (!documentUrl)
    throw new SpeechError(
      'unsupported-environment',
      'A browser document or worker URL is required to resolve speech assets.'
    );
  return new URL(file, new URL(base.endsWith('/') ? base : `${base}/`, documentUrl)).href;
};

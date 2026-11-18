import { createContext, useContext } from 'react';
import type { TranscriptionErrorCode } from '@katakit/transcription';
import type { TranscriptionModelId } from '@katakit/transcription/browser';

/**
 * What a visitor did in the gallery, for a host that measures usage. Events carry catalogued
 * keys, error codes, counts, and durations. They never carry audio, transcript text, prompts,
 * model output, or any other visitor-entered content; keep it that way when adding one.
 */
export type GalleryEventDetail =
  | { type: 'speechModelChanged'; model: TranscriptionModelId }
  | {
      type: 'speechModelLoadFinished';
      model: TranscriptionModelId;
      outcome: 'completed' | 'failed' | 'cancelled';
      durationMs: number;
      errorCode?: TranscriptionErrorCode;
    }
  | { type: 'microphoneRequested'; model: TranscriptionModelId }
  | {
      type: 'microphoneAnswered';
      outcome: 'granted' | 'denied' | 'unavailable' | 'cancelled';
      errorCode?: TranscriptionErrorCode;
    }
  | { type: 'recordingStarted'; model: TranscriptionModelId }
  | {
      type: 'recordingStopped';
      model: TranscriptionModelId;
      durationMs: number;
      /** Finalized speech segments delivered to the demo during this recording. */
      segmentCount: number;
    }
  /** A demo action its gallery adapter owns, such as starting a Color Clash round. */
  | { type: 'demoControlUsed'; control: 'play' | 'cancel' | 'startNotes' }
  /** A click on a control inside the demo's own content, outside the capture controls. */
  | { type: 'demoInteracted'; element: 'button' | 'select' | 'input' | 'link' };

/** `demoId` is absent on Welcome and other pages that are not a demo. */
export type GalleryEvent = GalleryEventDetail & { demoId?: string };

/** `GallerySpeechProvider` supplies this; without a host handler every report does nothing. */
export const GalleryEventsContext = createContext<{
  report: (event: GalleryEvent) => void;
  setActiveDemo: (demoId: string | undefined) => void;
}>({ report: () => {}, setActiveDemo: () => {} });

export const useGalleryEvents = () => useContext(GalleryEventsContext);

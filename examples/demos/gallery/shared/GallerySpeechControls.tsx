import { useContext, type ReactNode } from 'react';
import type { TranscriptionModelId } from '@katakit/transcription/browser';
import { useGallerySpeech } from './GallerySpeechProvider';
import { GalleryModelContext } from './galleryModel';
import { GalleryMicrophoneReadiness } from './GalleryMicrophoneReadiness';
import { GalleryMicrophoneIndicator } from './GalleryMicrophoneIndicator';
import { Settings } from 'lucide-react';
import { GalleryAccountButton } from './GalleryAccountButton';
import { GalleryUsageMeter, galleryUsagePercent } from './GalleryUsageMeter';
import { GalleryTooltipButton } from './GalleryTooltip';
import './galleryFooterControls.css';

/** Kept as a host adapter type; model selection now lives in developer Configure models. */
export type GalleryModelSelect = (props: {
  model: TranscriptionModelId;
  disabled: boolean;
  onChange: (model: TranscriptionModelId) => void;
}) => ReactNode;

/** Shared setup, capture, usage, and account display; recording stays in the demo. */
export const GallerySpeechControls = (_props: { renderModelSelect?: GalleryModelSelect }) => {
  const session = useGallerySpeech();
  const { isDeveloperView, openSettings, allowance, usageUnavailableReason, account } =
    useContext(GalleryModelContext);
  const snapshot = session?.snapshot;
  const percent = galleryUsagePercent(allowance);
  const phase =
    percent === undefined
      ? 'unavailable'
      : percent >= 100
        ? 'exhausted'
        : percent >= 80
          ? 'warning'
          : 'normal';
  return (
    <section
      className="gallery-footer-controls"
      aria-label="Operation status"
      data-usage-phase={phase}
      data-guest={!account?.user}
    >
      <div className="gallery-speech-indicators" role="group" aria-label="Gallery controls">
        <GalleryMicrophoneReadiness side="top" align="start" />
        <GalleryMicrophoneIndicator
          recording={snapshot?.input.phase === 'running'}
          level={snapshot?.level ?? 0}
          size="small"
        />
        {openSettings && (
          <GalleryTooltipButton
            className="gallery-footer-icon gallery-settings-button"
            aria-label="Settings"
            description={isDeveloperView ? 'Configure models' : 'Account and demo allowance'}
            onClick={openSettings}
          >
            <Settings aria-hidden="true" />
          </GalleryTooltipButton>
        )}
        <GalleryAccountButton />
      </div>
      <GalleryUsageMeter percent={percent} unavailableReason={usageUnavailableReason} />
      {(snapshot?.error || snapshot?.input.error) && (
        <p role="alert">{snapshot.error ?? snapshot.input.error?.message}</p>
      )}
    </section>
  );
};

import { useContext } from 'react';
import { useGallerySpeech } from './GallerySpeechProvider';
import { GalleryModelContext } from './galleryModel';
import { Settings } from 'lucide-react';
import { GalleryAccountButton } from './GalleryAccountButton';
import { GalleryUsageMeter, galleryUsagePercent } from './GalleryUsageMeter';
import { GalleryTooltipButton } from './GalleryTooltip';
import './galleryFooterControls.css';

/** Shared settings, usage, and account display; listening and its indicator stay in the demo. */
export const GallerySpeechControls = () => {
  const session = useGallerySpeech();
  const { isDeveloperView, openSettings, allowance, account } = useContext(GalleryModelContext);
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
      {/* The footer has no usage row until an allowance is reported; Settings explains why. */}
      {percent !== undefined && <GalleryUsageMeter percent={percent} />}
      {(snapshot?.error || snapshot?.input.error) && (
        <p role="alert">{snapshot.error ?? snapshot.input.error?.message}</p>
      )}
    </section>
  );
};

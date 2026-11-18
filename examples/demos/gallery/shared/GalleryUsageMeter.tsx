import { CircleAlert } from 'lucide-react';
import { GalleryTooltipButton } from './GalleryTooltip';
import type { GalleryAllowance } from './GalleryUsageProvider';

/** Percent used is derived only from a valid host allowance; missing data is never shown as 0%. */
export const galleryUsagePercent = (allowance?: GalleryAllowance) => {
  if (
    !allowance ||
    !Number.isFinite(allowance.total) ||
    !Number.isFinite(allowance.remaining) ||
    allowance.total <= 0 ||
    allowance.remaining < 0 ||
    allowance.remaining > allowance.total
  )
    return undefined;
  return allowance.remaining === 0
    ? 100
    : Math.min(99, Math.floor((1 - allowance.remaining / allowance.total) * 100 + 1e-8));
};

export const GalleryUsageMeter = ({
  percent,
  unavailableReason,
}: {
  percent?: number;
  unavailableReason?: string;
}) => {
  if (percent === undefined)
    return (
      <div className="gallery-usage-unavailable" role="alert">
        <GalleryTooltipButton
          className="gallery-usage-error-button"
          aria-label="Usage unavailable"
          description={unavailableReason ?? 'The service has not reported usage yet.'}
        >
          <CircleAlert aria-hidden="true" />
          <span>Usage unavailable</span>
        </GalleryTooltipButton>
      </div>
    );
  const description = `${percent}% of your demo allowance has been used; ${100 - percent}% remains. Cloud model requests use this allowance; on-device transcription does not.`;
  return (
    <GalleryTooltipButton
      className="gallery-usage-meter"
      aria-label={description}
      description={description}
    >
      <progress
        aria-label="Demo allowance used"
        aria-valuetext={`${percent}% used; ${100 - percent}% remaining`}
        max={100}
        value={percent}
      />
      <span className="gallery-usage-percent" aria-live="polite">
        {percent}%
      </span>
    </GalleryTooltipButton>
  );
};

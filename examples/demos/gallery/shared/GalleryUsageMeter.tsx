import { CircleAlert } from 'lucide-react';
import { GalleryTooltipButton } from './GalleryTooltip';
import type { GalleryAllowance, GalleryTokenUsage } from './GalleryUsageProvider';

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
  const description = `${percent}% of your allowed model calls used; ${100 - percent}% remaining. Usage comes from the model proxy; on-device transcription does not use model calls.`;
  return (
    <GalleryTooltipButton
      className="gallery-usage-meter"
      aria-label={description}
      description={description}
    >
      <span>Usage</span>
      <progress
        aria-label="Model call usage"
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

/** Personal keys have no gallery budget, so show tokens rather than a percentage bar. */
export const GalleryTokenCounter = ({ usage }: { usage: GalleryTokenUsage }) => {
  const total = usage.total.toLocaleString('en-US');
  const value = usage.incomplete
    ? usage.total > 0
      ? `≥${total} tokens`
      : 'Unavailable'
    : `${total} tokens`;
  const description = `${usage.incomplete ? 'Some responses did not report token usage. ' : ''}${total} input and output tokens reported for personal-key responses this session. The count includes all keys and models used in this tab and resets on reload. Canceled requests may use tokens that are not reported here.`;
  return (
    <GalleryTooltipButton
      className="gallery-usage-meter"
      aria-label={`Usage: ${value} this session`}
      description={description}
    >
      <span>Usage</span>
      <span className="gallery-usage-tokens" aria-live="polite">
        {value}
      </span>
    </GalleryTooltipButton>
  );
};

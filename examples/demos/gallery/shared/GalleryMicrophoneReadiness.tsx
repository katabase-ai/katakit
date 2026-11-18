import { Circle, CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import { useGallerySpeech } from './GallerySpeechProvider';
import { GalleryTooltipButton, type GalleryTooltipPosition } from './GalleryTooltip';
import './galleryMicrophone.css';

const readinessLabels = {
  untested: 'Not set up',
  active: 'Setting up',
  success: 'Ready',
  error: 'Needs attention',
} as const;

/** Shared setup readiness; disclosure never acquires microphone input. */
export const GalleryMicrophoneReadiness = ({
  side = 'bottom',
  align = 'end',
}: GalleryTooltipPosition) => {
  const snapshot = useGallerySpeech()?.snapshot;
  const failed = !!(snapshot?.blocked || snapshot?.error || snapshot?.input.error);
  const successful = !!snapshot?.microphoneVerified && !failed;
  const settingUp =
    snapshot?.starting || ['loading', 'starting'].includes(snapshot?.input.phase ?? '');
  const state = failed ? 'error' : successful ? 'success' : settingUp ? 'active' : 'untested';
  const Icon = { untested: Circle, active: LoaderCircle, success: CircleCheck, error: CircleAlert }[
    state
  ];
  const label = readinessLabels[state];
  return (
    <span className="gallery-microphone-readiness" data-state={state}>
      <GalleryTooltipButton
        className="gallery-microphone-readiness-button"
        aria-label={`Microphone setup: ${label}`}
        description={label}
        side={side}
        align={align}
      >
        <Icon aria-hidden="true" />
      </GalleryTooltipButton>
    </span>
  );
};

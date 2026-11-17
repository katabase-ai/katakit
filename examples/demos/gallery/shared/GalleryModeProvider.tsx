import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react';
import { useGalleryInference } from './GalleryInferenceProvider';

const Context = createContext({
  developerMode: false,
  isPublicPreview: false,
  isDeveloperView: false,
  setPublicPreview: (_preview: boolean) => {},
});

/**
 * `developerMode` is the host's build capability; `isDeveloperView` is the effective UI/connection policy.
 * Public preview temporarily disables that policy without changing the build or saved settings.
 * Public is the default; visitor URLs/storage never enable developer tools.
 */
export const GalleryModeProvider = ({
  developerMode = false,
  children,
}: {
  developerMode?: boolean;
  children: ReactNode;
}) => {
  const inference = useGalleryInference();
  const [isPublicPreview, updatePublicPreview] = useState(false);
  const setPublicPreview = useCallback(
    (next: boolean) => {
      if (!developerMode || next === isPublicPreview) return;
      // Invalidate before React commits the mode switch, including providers that return late.
      inference?.owner.invalidate();
      updatePublicPreview(next);
    },
    [developerMode, inference, isPublicPreview]
  );
  return (
    <Context
      value={{
        developerMode,
        isPublicPreview,
        isDeveloperView: developerMode && !isPublicPreview,
        setPublicPreview,
      }}
    >
      {children}
    </Context>
  );
};
export const useGalleryMode = () => useContext(Context);

/** The preview exit stays visible in developer builds; public builds never render this switch. */
export const GalleryPreviewToggle = ({
  onChange,
}: {
  onChange?: (isPublicPreview: boolean) => void;
}) => {
  const { developerMode, isPublicPreview, setPublicPreview } = useGalleryMode();
  const tooltipId = useId();
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  useEffect(() => {
    if (!developerMode) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTooltipDismissed(true);
    };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [developerMode]);
  if (!developerMode) return null;
  return (
    <span
      className="gallery-preview-control"
      data-tooltip-dismissed={tooltipDismissed}
      onPointerEnter={() => setTooltipDismissed(false)}
    >
      <label className="gallery-preview-toggle">
        <input
          type="checkbox"
          role="switch"
          checked={isPublicPreview}
          aria-describedby={tooltipId}
          onFocus={() => setTooltipDismissed(false)}
          onChange={event => {
            const next = event.target.checked;
            setPublicPreview(next);
            onChange?.(next);
          }}
        />
        <span className="gallery-preview-label">
          {isPublicPreview ? 'Public preview' : 'Developer mode'}
        </span>
        <span className="gallery-preview-track" aria-hidden="true" />
      </label>
      <span className="gallery-preview-tooltip" id={tooltipId} role="tooltip">
        {isPublicPreview
          ? 'This is what people will see on the public gallery.'
          : 'Configure and test model connections.'}
      </span>
    </span>
  );
};

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useGalleryInference } from './GalleryInferenceProvider';
import { GalleryTooltip } from './GalleryTooltip';

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
  if (!developerMode) return null;
  return (
    <GalleryTooltip
      className="gallery-preview-control"
      side="bottom"
      align="end"
      dismissOnActivate
      description={
        isPublicPreview
          ? 'This is what people will see on the public gallery.'
          : 'Configure and test model connections.'
      }
    >
      {trigger => (
        <label className="gallery-preview-toggle">
          <input
            {...trigger}
            type="checkbox"
            role="switch"
            checked={isPublicPreview}
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
      )}
    </GalleryTooltip>
  );
};

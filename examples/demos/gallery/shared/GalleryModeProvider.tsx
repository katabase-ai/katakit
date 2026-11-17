import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useGalleryInference } from './GalleryInferenceProvider';

const Context = createContext({
  developerMode: false,
  preview: false,
  editing: false,
  setPreview: (_preview: boolean) => {},
});

/** Hosts opt in through trusted build configuration. Public is the default, never a URL/storage flag. */
export const GalleryModeProvider = ({
  developerMode = false,
  children,
}: {
  developerMode?: boolean;
  children: ReactNode;
}) => {
  const inference = useGalleryInference();
  const [preview, updatePreview] = useState(false);
  const setPreview = useCallback(
    (next: boolean) => {
      if (!developerMode || next === preview) return;
      // Invalidate before React commits the mode switch, including providers that return late.
      inference?.owner.invalidate();
      updatePreview(next);
    },
    [developerMode, inference, preview]
  );
  return (
    <Context value={{ developerMode, preview, editing: developerMode && !preview, setPreview }}>
      {children}
    </Context>
  );
};
export const useGalleryMode = () => useContext(Context);

/** The preview exit stays visible in developer builds; public builds never render this switch. */
export const GalleryPreviewToggle = ({ onChange }: { onChange?: (preview: boolean) => void }) => {
  const { developerMode, preview, setPreview } = useGalleryMode();
  if (!developerMode) return null;
  return (
    <button
      type="button"
      className="gallery-preview-toggle"
      aria-pressed={preview}
      title={preview ? 'Return to developer mode' : 'Preview the public gallery'}
      onClick={() => {
        setPreview(!preview);
        onChange?.(!preview);
      }}
    >
      {preview ? 'Public preview' : 'Preview'}
    </button>
  );
};

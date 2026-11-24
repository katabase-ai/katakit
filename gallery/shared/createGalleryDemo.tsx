import type { ComponentType, ReactNode } from 'react';
import type { GalleryInputSink } from './createGallerySpeech';
import { GalleryDemo } from './GalleryDemo';
import { GalleryCaptureControls } from './GalleryCaptureControls';
import { useGalleryDemoHeader } from './GalleryDemoHeader';

/** Structural view contract: examples use these ordinary props without importing the gallery. */
export type GalleryDemoViewProps<T> = {
  runtime: T;
  controls?: ReactNode;
  showIntroduction?: boolean;
};

/** Wraps presentation only; GalleryDemo owns attachment, readiness, and release. */
export const createGalleryDemo = <T extends GalleryInputSink>({
  createRuntime,
  View,
}: {
  createRuntime: () => T;
  View: ComponentType<GalleryDemoViewProps<T>>;
}) => {
  const HostedDemo = () => {
    const hasHeader = useGalleryDemoHeader();
    return (
      <GalleryDemo
        create={createRuntime}
        render={runtime => (
          <View
            runtime={runtime}
            controls={<GalleryCaptureControls />}
            showIntroduction={!hasHeader}
          />
        )}
      />
    );
  };
  return HostedDemo;
};

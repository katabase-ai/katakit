import { useEffect, useState, type ReactNode } from 'react';
import type { GalleryInputSink } from './createGallerySpeech';
import { useGallerySpeech } from './GallerySpeechProvider';

/** React unmount releases a lease; the owner keeps its sink alive until stop/drain completes. */
export const GalleryDemo = <T extends GalleryInputSink>({
  create,
  render,
}: {
  create: () => T;
  render: (runtime: T) => ReactNode;
}) => {
  const session = useGallerySpeech();
  const owner = session?.owner;
  const [runtime, setRuntime] = useState<T>();
  useEffect(() => {
    if (!owner) return;
    let mounted = true;
    const attachment = owner.attach(create);
    void (async () => {
      const current = await attachment.ready;
      if (mounted) setRuntime(current);
    })();
    return () => {
      mounted = false;
      void attachment.release();
    };
  }, [owner, create]);
  if (!runtime) return <p role="status">Preparing demo…</p>;
  return render(runtime);
};

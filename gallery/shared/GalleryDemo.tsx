import { useEffect, useState, type ReactNode } from 'react';
import type { GalleryInputSink } from './createGallerySpeech';
import { useGallerySpeech } from './GallerySpeechProvider';
import { useGalleryDemoReady } from './GalleryDemoFrame';

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
  const [result, setResult] = useState<{
    owner: typeof owner;
    create: () => T;
    runtime: T | undefined;
  }>();
  const settled = !!result && result.owner === owner && result.create === create;
  const runtime = settled ? result.runtime : undefined;
  const inFrame = useGalleryDemoReady(settled);
  useEffect(() => {
    if (!owner) return;
    let mounted = true;
    const attachment = owner.attach(create);
    void (async () => {
      const current = await attachment.ready;
      if (mounted) setResult({ owner, create, runtime: current });
    })();
    return () => {
      mounted = false;
      void attachment.release();
    };
  }, [owner, create]);
  if (!runtime) {
    if (settled)
      return (
        <p role="alert">
          {session?.snapshot.error ?? 'Could not prepare this demo. Reload to try again.'}
        </p>
      );
    return inFrame ? null : <p role="status">Preparing demo…</p>;
  }
  return render(runtime);
};

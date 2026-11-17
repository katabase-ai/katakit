import { createFileRoute, redirect } from '@tanstack/react-router';
import { GalleryPage } from '../GalleryPage';
import { galleryDeveloperBuild } from '../galleryEnvironment';
export const Route = createFileRoute('/operations/grid')({
  beforeLoad: () => {
    if (!galleryDeveloperBuild) throw redirect({ to: '/' });
  },
  head: () => ({ meta: [{ title: 'Operation Grid · Katakit' }] }),
  component: () => <GalleryPage developerPage="grid" />,
});

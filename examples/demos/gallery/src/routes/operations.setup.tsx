import { createFileRoute, redirect } from '@tanstack/react-router';
import { GalleryPage } from '../GalleryPage';
import { galleryDeveloperBuild } from '../galleryEnvironment';
export const Route = createFileRoute('/operations/setup')({
  beforeLoad: () => {
    if (!galleryDeveloperBuild) throw redirect({ to: '/' });
  },
  head: () => ({ meta: [{ title: 'Operation Setup · Katakit' }] }),
  component: () => <GalleryPage developerPage="setup" />,
});

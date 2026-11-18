import { createFileRoute } from '@tanstack/react-router';
import { GalleryPage } from '../GalleryPage';

export const Route = createFileRoute('/settings')({
  head: () => ({ meta: [{ title: 'Settings · Katakit' }] }),
  component: () => <GalleryPage settingsPage />,
});

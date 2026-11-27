import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
import { galleryDemos } from '../../shared/galleryDemos';
import { GalleryPage } from '../GalleryPage';

export const Route = createFileRoute('/demos/$demoId')({
  loader: ({ params }) => {
    if (params.demoId === 'brainstorm') {
      throw redirect({ to: '/demos/$demoId', params: { demoId: 'word-rush' } });
    }
    const demo = galleryDemos.find(entry => entry.id === params.demoId);
    if (!demo) throw notFound();
    return { id: demo.id, title: demo.title };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title ?? 'Demo'} · Katakit` }] }),
  component: () => {
    const { id } = Route.useLoaderData();
    return <GalleryPage demo={galleryDemos.find(entry => entry.id === id)} />;
  },
});

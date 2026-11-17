import { createFileRoute, notFound } from '@tanstack/react-router';
import { galleryDemos } from '../../shared/galleryDemos';
import { GalleryPage } from '../GalleryPage';

export const Route = createFileRoute('/demos/$demoId')({
  loader: ({ params }) => {
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

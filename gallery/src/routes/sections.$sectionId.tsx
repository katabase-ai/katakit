import { createFileRoute, notFound } from '@tanstack/react-router';
import { galleryDemoSections } from '../../shared/galleryDemoDetails';
import { GalleryPage } from '../GalleryPage';

export const Route = createFileRoute('/sections/$sectionId')({
  loader: ({ params }) => {
    const section = galleryDemoSections.find(section => section.toLowerCase() === params.sectionId);
    if (!section) throw notFound();
    return { section };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.section ?? 'Section'} · Katakit` }],
  }),
  component: () => {
    const { section } = Route.useLoaderData();
    return <GalleryPage section={section} />;
  },
});

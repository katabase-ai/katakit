import { createFileRoute } from '@tanstack/react-router';
import { GalleryPage } from '../GalleryPage';

export const Route = createFileRoute('/')({ component: GalleryPage });

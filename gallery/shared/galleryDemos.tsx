import { lazy } from 'react';
import {
  galleryDemoDetails,
  transcriptionDemoDetails,
  bingoDemoDetails,
  notesDemoDetails,
  colorClashDemoDetails,
  listExtractionDemoDetails,
  wordRushDemoDetails,
  type GalleryDemoMetadata,
} from './galleryDemoDetails';

/** Registration is inert: React invokes the loader only when the component is rendered. */
export const registerGalleryDemo = <T extends GalleryDemoMetadata>(details: T) => ({
  ...details,
  component: lazy(details.load),
});

/** Named selections avoid retaining the aggregate catalogue in narrow host bundles. */
export const transcriptionGalleryDemo =
  /* @__PURE__ */ registerGalleryDemo(transcriptionDemoDetails);
export const bingoGalleryDemo = /* @__PURE__ */ registerGalleryDemo(bingoDemoDetails);
export const notesGalleryDemo = /* @__PURE__ */ registerGalleryDemo(notesDemoDetails);
export const colorClashGalleryDemo = /* @__PURE__ */ registerGalleryDemo(colorClashDemoDetails);
export const listExtractionGalleryDemo =
  /* @__PURE__ */ registerGalleryDemo(listExtractionDemoDetails);
export const wordRushGalleryDemo = /* @__PURE__ */ registerGalleryDemo(wordRushDemoDetails);

/** All eligible demos follow catalogue order; hosts can instead import named selections. */
export const galleryDemos = /* @__PURE__ */ galleryDemoDetails.map(registerGalleryDemo);

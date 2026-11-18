/** Only host build configuration enables developer tools; visitor URLs/storage cannot opt in. */
export const galleryDeveloperBuild =
  import.meta.env.DEV || import.meta.env.VITE_GALLERY_DEV_MODE === 'true';

/** The Vite dev server runs the model connection plugin; built and previewed output does not. */
export const galleryLocalInference = import.meta.env.DEV;

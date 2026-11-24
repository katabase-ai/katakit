/** Only host build configuration enables developer tools; visitor URLs/storage cannot opt in. */
export const galleryDeveloperBuild =
  import.meta.env.DEV || import.meta.env.VITE_GALLERY_DEV_MODE === 'true';

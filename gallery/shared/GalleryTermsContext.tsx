import { createContext } from 'react';

/** The embedding host owns the Terms URL; controls also work without a configured policy. */
export const GalleryTermsContext = createContext<string | undefined>(undefined);

export type NavItem = { label: string; slug?: string; children?: NavItem[] };

export type DocsBundle = {
  navigation: NavItem[];
  pages: Record<string, { file: string; markdown: string }>;
  assets: Record<string, string>;
};

/** Resolve against exported file paths, including normalized section landing pages. */
export const pageHref = ({
  href,
  slug,
  bundle,
}: {
  href: string;
  slug: string;
  bundle: DocsBundle;
}) => {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/|#)/i.test(href)) return href;
  const target = new URL(href, `https://docs.local/${bundle.pages[slug].file}`);
  const file = decodeURIComponent(target.pathname.slice(1));
  const page = Object.entries(bundle.pages).find(([, page]) => page.file === file);
  if (page) return `/${page[0]}${target.search}${target.hash}`;
  const asset = bundle.assets[file];
  if (asset) return `${asset}${target.search}${target.hash}`;
  throw new Error(`Missing exported target ${href} in ${slug}`);
};

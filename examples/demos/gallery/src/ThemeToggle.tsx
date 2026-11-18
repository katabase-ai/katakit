import { useEffect, useState } from 'react';

/** The reference host owns theme preference; embedded galleries keep their host's switch. */
export const ThemeToggle = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>();
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('katakit.gallery.theme');
    } catch {
      /* OS preference still works when storage is blocked. */
    }
    setTheme(
      saved === 'light' || saved === 'dark'
        ? saved
        : matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
    );
  }, []);
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <button
      type="button"
      className="gallery-theme-toggle"
      disabled={!theme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      onClick={() => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        try {
          localStorage.setItem('katakit.gallery.theme', next);
        } catch {
          /* Retain the choice for this page without claiming persistence. */
        }
      }}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
    </button>
  );
};

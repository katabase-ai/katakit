import { useRef } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { GalleryPreviewToggle } from '../shared/GalleryModeProvider';
import { ThemeToggle } from './ThemeToggle';

/** Previewing a developer-only page opens Welcome; exiting returns to that settings page. */
export const GalleryHeader = () => {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: state => state.location.pathname });
  const previousTools = useRef<'/operations/setup' | '/operations/grid'>(undefined);
  return (
    <header className="gallery-header">
      <Link to="/">Katakit · Demos</Link>
      <div className="gallery-header-actions">
        <GalleryPreviewToggle
          onChange={isPublicPreview => {
            if (isPublicPreview) {
              previousTools.current =
                pathname === '/operations/setup' || pathname === '/operations/grid'
                  ? pathname
                  : undefined;
              if (previousTools.current) void navigate({ to: '/' });
            } else if (previousTools.current) void navigate({ to: previousTools.current });
          }}
        />
        <ThemeToggle />
      </div>
    </header>
  );
};

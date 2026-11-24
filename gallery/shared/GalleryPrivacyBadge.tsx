import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  createLucideIcon,
  Shield,
  SquareArrowOutUpRight as SquareArrowUpRightExit,
} from 'lucide-react';
import type { GalleryDataHandling } from './galleryDemoDetails';
import './galleryTooltip.css';
import './galleryPrivacy.css';

// Geometry from the supplied shield-cloud.svg, rendered with the gallery's Lucide sizing/theme.
const ShieldCloud = createLucideIcon({
  name: 'shield-cloud',
  size: 24,
  node: [
    [
      'path',
      {
        d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-.99c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
        key: 'shield',
      },
    ],
    [
      'path',
      {
        d: 'M14.48 15.65h-3.83a3.15 3.15 0 1 1 3.02-4.05h.81a2.03 2.03 0 1 1 0 4.05Z',
        key: 'cloud',
      },
    ],
  ],
});

const privacyLabel = (cloud: boolean) => (cloud ? 'Cloud-assisted' : 'On-device');

const PrivacyBadgeContent = ({ cloud }: { cloud: boolean }) => (
  <>
    {cloud ? <ShieldCloud aria-hidden="true" /> : <Shield aria-hidden="true" />}
    {privacyLabel(cloud)}
  </>
);

/** Static version of the demo badge for inline explanations, with the same icon and label. */
export const GalleryPrivacyPill = ({ dataHandling }: { dataHandling: GalleryDataHandling }) => (
  <span className="gallery-privacy-pill">
    <PrivacyBadgeContent cloud={dataHandling.transcribedText === 'cloud'} />
  </span>
);

/** Describes declared data handling, never current availability or a successful security check. */
export const GalleryPrivacyBadge = ({
  dataHandling,
  privacyUrl,
  cloudPrivacyDescription,
  developerEndpoint = false,
}: {
  dataHandling: GalleryDataHandling;
  privacyUrl?: string;
  /** A host's managed-service promise; the caller must omit it for developer endpoints. */
  cloudPrivacyDescription?: string;
  developerEndpoint?: boolean;
}) => {
  const cloud = dataHandling.transcribedText === 'cloud';
  const label = privacyLabel(cloud);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  const hovered = useRef(false);
  const focused = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const cancelHoverClose = useCallback(() => {
    clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
  }, []);

  // Bridge the diagonal gap into the wider panel; cancel on re-entry and release on unmount.
  useEffect(() => cancelHoverClose, [cancelHoverClose]);

  // Only disclosure state is transient. Opening this component never acquires a runtime or input.
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent | KeyboardEvent) => {
      if (event.type === 'keydown') {
        if ((event as KeyboardEvent).key !== 'Escape') return;
        if (panel.current?.contains(document.activeElement)) button.current?.focus();
      } else if (root.current?.contains(event.target as Node)) return;
      cancelHoverClose();
      pinned.current = false;
      setOpen(false);
    };
    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', dismiss);
    return () => {
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', dismiss);
    };
  }, [open, cancelHoverClose]);

  return (
    <div className="gallery-privacy-row">
      <div
        className="gallery-privacy-control"
        ref={root}
        onPointerEnter={event => {
          if (event.pointerType === 'touch') return;
          cancelHoverClose();
          hovered.current = true;
          setOpen(true);
        }}
        onPointerLeave={() => {
          hovered.current = false;
          if (!pinned.current && !focused.current) {
            cancelHoverClose();
            closeTimer.current = setTimeout(() => {
              closeTimer.current = undefined;
              if (!hovered.current && !pinned.current && !focused.current) setOpen(false);
            }, 150);
          }
        }}
        onFocus={() => {
          cancelHoverClose();
          focused.current = true;
          setOpen(true);
        }}
        onBlur={event => {
          if (event.currentTarget.contains(event.relatedTarget)) return;
          focused.current = false;
          pinned.current = false;
          cancelHoverClose();
          if (!hovered.current) setOpen(false);
        }}
      >
        <button
          ref={button}
          type="button"
          className="gallery-privacy-badge"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            cancelHoverClose();
            pinned.current = !pinned.current;
            setOpen(pinned.current);
          }}
        >
          <PrivacyBadgeContent cloud={cloud} />
        </button>
        <div
          ref={panel}
          id={panelId}
          className="gallery-privacy-panel"
          role="dialog"
          aria-label={`${label} data handling`}
          hidden={!open}
        >
          <div
            className="gallery-privacy-popover gallery-hover-panel"
            data-side="bottom"
            data-align="end"
          >
            <ul className="gallery-privacy-facts">
              <li>
                <Shield aria-hidden="true" />
                <span>Audio stays on your device</span>
              </li>
              <li>
                <Shield aria-hidden="true" />
                <span>
                  {!cloud ? (
                    <>
                      Transcribed text stays
                      <br />
                      on your device
                    </>
                  ) : developerEndpoint ? (
                    <>Transcribed text is processed by your configured service</>
                  ) : cloudPrivacyDescription ? (
                    cloudPrivacyDescription
                  ) : (
                    <>
                      Transcribed text is processed
                      <br />
                      on cloud servers
                    </>
                  )}
                </span>
              </li>
            </ul>
            {privacyUrl && (
              <div className="gallery-privacy-footer">
                <a href={privacyUrl} target="_blank" rel="noopener noreferrer">
                  <span className="gallery-privacy-link-label">Privacy policy</span>
                  <SquareArrowUpRightExit aria-hidden="true" />
                  <span className="gallery-visually-hidden"> (opens in a new tab)</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

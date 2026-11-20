import { useContext, useEffect, useRef, useState } from 'react';
import { Plus, UserRound } from 'lucide-react';
import { GalleryModelContext } from './galleryModel';
import { GalleryTooltip, GalleryTooltipButton } from './GalleryTooltip';

/** Identity and account actions belong to the embedding host, never browser inference settings. */
export type GalleryAccount = {
  user?: { name: string; avatarUrl?: string };
  /** Host-owned waitlist destination, independent of account authentication. */
  waitlistUrl?: string;
  onOpenAccount?: () => void;
};

export const GalleryAccountButton = () => {
  const { account } = useContext(GalleryModelContext);
  const [open, setOpen] = useState(false);
  const [failedImage, setFailedImage] = useState<string>();
  const root = useRef<HTMLDivElement>(null);
  const user = account?.user;
  const supported = !!account?.onOpenAccount;
  const label = `Account${user?.name ? `: ${user.name}` : ''}`;
  const words = user?.name.trim().split(/\s+/).filter(Boolean) ?? [];
  const initials = (words.length > 1 ? [words[0], words.at(-1)] : words)
    .map(word => word?.[0] ?? '')
    .join('')
    .toUpperCase();
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent | KeyboardEvent) => {
      if (event.type === 'keydown') {
        if ((event as KeyboardEvent).key !== 'Escape') return;
        root.current?.querySelector<HTMLButtonElement>('button')?.focus();
      } else if (root.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', dismiss);
    };
  }, [open]);
  const activate = (action: () => void) => {
    setOpen(false);
    action();
  };
  if (!user)
    return account?.waitlistUrl ? (
      <GalleryTooltip
        description="Join the waitlist"
        className="gallery-account-tooltip"
        dismissOnActivate
      >
        {trigger => (
          <a
            {...trigger}
            className="gallery-footer-icon gallery-waitlist-link"
            href={account.waitlistUrl}
            aria-label="Join the waitlist"
          >
            <span className="gallery-account-avatar" aria-hidden="true">
              <UserRound />
              <span className="gallery-account-plus">
                <Plus />
              </span>
            </span>
          </a>
        )}
      </GalleryTooltip>
    ) : null;
  return (
    <div
      className="gallery-account"
      ref={root}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <GalleryTooltipButton
        className="gallery-footer-icon gallery-account-button"
        align="start"
        tooltipClassName="gallery-account-tooltip"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        description={supported ? label : 'Account access is not available in this gallery host.'}
        onClick={() => setOpen(current => !current)}
      >
        <span className="gallery-account-avatar" aria-hidden="true">
          {user?.avatarUrl && failedImage !== user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setFailedImage(user.avatarUrl)}
            />
          ) : (
            initials || <UserRound />
          )}
        </span>
      </GalleryTooltipButton>
      {open && (
        <div
          className="gallery-account-panel gallery-hover-panel"
          data-side="top"
          data-align="start"
          role="dialog"
          aria-label="Your account"
        >
          {supported ? (
            <>
              <p>{user.name}</p>
              {user && account?.onOpenAccount && (
                <button
                  className="site-button"
                  type="button"
                  onClick={() => activate(account.onOpenAccount!)}
                >
                  Manage account
                </button>
              )}
            </>
          ) : (
            <p>Account access is not available in this gallery host.</p>
          )}
        </div>
      )}
    </div>
  );
};

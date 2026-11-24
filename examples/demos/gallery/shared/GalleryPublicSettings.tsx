import { useContext, useState } from 'react';
import { GalleryModelContext } from './galleryModel';
import { GalleryTokenCounter, GalleryUsageMeter, galleryUsagePercent } from './GalleryUsageMeter';
import './galleryFooterControls.css';
import './galleryPublicSettings.css';

/** Public account presentation; the host owns real identity, authentication, and allowance. */
export const GalleryPublicSettings = ({
  privacyUrl,
  termsUrl,
}: {
  privacyUrl?: string;
  termsUrl?: string;
}) => {
  const { account, allowance, tokenUsage, usageUnavailableReason } =
    useContext(GalleryModelContext);
  const [notice, setNotice] = useState('');
  const percent = galleryUsagePercent(allowance);
  const phase =
    percent === undefined
      ? 'unavailable'
      : percent >= 100
        ? 'exhausted'
        : percent >= 80
          ? 'warning'
          : 'normal';
  const activate = (action: (() => void) | undefined, unavailable: string) => {
    setNotice(action ? '' : unavailable);
    action?.();
  };
  return (
    <article className="gallery-public-settings" aria-labelledby="gallery-settings-title">
      <h1 id="gallery-settings-title">Settings</h1>
      <section
        className="gallery-settings-account"
        aria-labelledby="gallery-settings-account-title"
      >
        {account?.user ? (
          <>
            <h2 id="gallery-settings-account-title">Your Katabase account</h2>
            <p>
              Signed in as <strong>{account.user.name}</strong>.
            </p>
            <button
              type="button"
              className="site-button"
              onClick={() =>
                activate(account.onOpenAccount, 'Account settings aren’t available here yet.')
              }
            >
              Manage account
            </button>
          </>
        ) : (
          <>
            <h2 id="gallery-settings-account-title">Take your ideas further with Katabase</h2>
            <p>
              A place to understand how your applications behave, learn from real interactions, and
              make them better as they grow. From experimenting with prompts and models to tracking
              quality, latency, and cost, Katabase will help you take the next step.
            </p>
            <div className="gallery-settings-account-actions">
              {account?.waitlistUrl && (
                <a className="site-button" href={account.waitlistUrl}>
                  Join the waitlist
                </a>
              )}
            </div>
          </>
        )}
        <p className="gallery-settings-account-notice" role="status">
          {notice}
        </p>
      </section>
      <section
        className="gallery-settings-allowance"
        data-usage-phase={phase}
        aria-labelledby="gallery-settings-allowance-title"
      >
        <h2 id="gallery-settings-allowance-title">Usage</h2>
        {tokenUsage ? (
          <>
            <GalleryTokenCounter usage={tokenUsage} />
            <p>Personal-key tokens used this session. Reloading starts a new count.</p>
          </>
        ) : (
          <>
            <GalleryUsageMeter percent={percent} unavailableReason={usageUnavailableReason} />
            <p>
              The percentage of allowed model calls used. On-device transcription doesn’t count.
            </p>
          </>
        )}
      </section>
      {(privacyUrl || termsUrl) && (
        <p className="gallery-settings-privacy">
          {privacyUrl && (
            <a href={privacyUrl} target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>
          )}
          {privacyUrl && termsUrl && ' and '}
          {termsUrl && (
            <a href={termsUrl} target="_blank" rel="noopener noreferrer">
              Terms of Service
            </a>
          )}
        </p>
      )}
    </article>
  );
};

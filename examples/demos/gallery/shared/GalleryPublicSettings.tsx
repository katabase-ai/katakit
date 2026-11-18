import { useContext, useState } from 'react';
import { GalleryModelContext } from './galleryModel';
import { GalleryUsageMeter, galleryUsagePercent } from './GalleryUsageMeter';
import './galleryFooterControls.css';
import './galleryPublicSettings.css';

/** Public account presentation; the host owns real identity, authentication, and allowance. */
export const GalleryPublicSettings = ({ privacyUrl }: { privacyUrl?: string }) => {
  const { account, allowance, usageUnavailableReason } = useContext(GalleryModelContext);
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
            <h2 id="gallery-settings-account-title">Every demo. One Katabase account.</h2>
            <p>
              Create an account to get more tokens for cloud-based models and access to developer
              tools. We take care of the model setup, so you can focus on exploring and building.
            </p>
            <div className="gallery-settings-account-actions">
              <button
                type="button"
                className="site-button"
                onClick={() =>
                  activate(account?.onCreateAccount, 'Account creation isn’t available here yet.')
                }
              >
                Create an account
              </button>
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  className="gallery-settings-sign-in"
                  onClick={() => activate(account?.onLogIn, 'Sign-in isn’t available here yet.')}
                >
                  Sign in
                </button>
              </span>
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
        <h2 id="gallery-settings-allowance-title">Your demo allowance</h2>
        <GalleryUsageMeter percent={percent} unavailableReason={usageUnavailableReason} />
        <p>Cloud-based demos use this allowance. On-device transcription doesn’t.</p>
      </section>
      {privacyUrl && (
        <p className="gallery-settings-privacy">
          See{' '}
          <a href={privacyUrl} target="_blank" rel="noopener noreferrer">
            {privacyUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </a>{' '}
          for more information.
        </p>
      )}
    </article>
  );
};

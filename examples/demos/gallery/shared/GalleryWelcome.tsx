import { GalleryPrivacyPill } from './GalleryPrivacyBadge';
import { GalleryWelcomeMicrophone } from './GalleryWelcomeMicrophone';
import { GalleryDemoHeader, useGalleryDemoHeader } from './GalleryDemoHeader';
import { useGalleryDemoReady } from './GalleryDemoFrame';
import { galleryWelcomeDetails } from './galleryWelcomeDetails';
import './galleryWelcome.css';

export const GalleryWelcome = ({ privacyUrl }: { privacyUrl?: string }) => {
  const hasHeader = useGalleryDemoHeader();
  // Page readiness follows code/hydration, not microphone permission or model downloads.
  useGalleryDemoReady(true);
  const content = (
    <div className="gallery-welcome">
      <GalleryWelcomeMicrophone />
      <section className="gallery-welcome-section" aria-labelledby="gallery-cloud-title">
        <h2 id="gallery-cloud-title">How cloud servers work</h2>
        <p>
          Some demos use cloud-based models. This can be as simple as converting text from one
          format to another. In more interesting cases, they reason about the conversation as it
          unfolds, using spoken context to connect ideas, explore possibilities, and help you think
          through what comes next.
        </p>
        <ul className="gallery-welcome-marker-key" aria-label="Demo data handling">
          <li>
            Demos marked with{' '}
            <GalleryPrivacyPill dataHandling={{ audio: 'device', transcribedText: 'device' }} />{' '}
            keep all your data on your device.
          </li>
          <li>
            Demos marked with{' '}
            <GalleryPrivacyPill dataHandling={{ audio: 'device', transcribedText: 'cloud' }} /> use
            cloud-based models to process transcript text. Your audio still stays on your device.
          </li>
        </ul>
        {privacyUrl && (
          <p className="gallery-welcome-privacy">
            See{' '}
            <a href={privacyUrl} target="_blank" rel="noopener noreferrer">
              {privacyUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>{' '}
            for more information.
          </p>
        )}
      </section>
    </div>
  );
  return hasHeader ? (
    content
  ) : (
    <GalleryDemoHeader demo={galleryWelcomeDetails}>{content}</GalleryDemoHeader>
  );
};

import { Cloud, Laptop } from 'lucide-react';
import { GalleryWelcomeMicrophone } from './GalleryWelcomeMicrophone';
import './galleryWelcome.css';

export const GalleryWelcome = ({ privacyUrl }: { privacyUrl?: string }) => (
  <div className="gallery-welcome">
    <h1>Welcome!</h1>
    <p className="gallery-intro">
      Each demo in this gallery does something different. Try them to get a feel for KataKit’s
      capabilities, and ideas for how voice-to-visual interfaces can work.
    </p>
    <GalleryWelcomeMicrophone />
    <section className="gallery-welcome-cloud" aria-labelledby="gallery-cloud-title">
      <h2 id="gallery-cloud-title">Cloud-based models</h2>
      <p>
        Some demos use cloud-based models. Their role can be as simple as converting text from one
        format to another. In more interesting cases, they reason about the conversation as it
        unfolds, using the transcript as context to connect ideas, explore possibilities, and help
        you think through what comes next.
      </p>
    </section>
    <ul className="gallery-welcome-marker-key" aria-label="Demo data handling">
      <li>
        Demos marked with{' '}
        <span className="gallery-welcome-marker" role="img" aria-label="On-device">
          <Laptop aria-hidden="true" />
        </span>{' '}
        keep all your data on your device.
      </li>
      <li>
        Demos marked with{' '}
        <span className="gallery-welcome-marker" role="img" aria-label="Cloud processing">
          <Cloud aria-hidden="true" />
        </span>{' '}
        use cloud-based models to process transcript text. Your audio still stays on your device.
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
  </div>
);

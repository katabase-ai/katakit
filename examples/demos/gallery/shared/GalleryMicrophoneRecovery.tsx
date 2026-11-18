import type { TranscriptionState } from '@katakit/transcription';

/** Owner failures take precedence over stale typed input errors. Shared by every gallery demo. */
export const getGalleryMicrophoneFailure = (snapshot: {
  input: TranscriptionState;
  error?: string;
  blocked?: boolean;
}) => {
  const inputError = snapshot.input.error;
  const code =
    !snapshot.blocked && (!snapshot.error || snapshot.error === inputError?.message)
      ? inputError?.code
      : undefined;
  const permissionDenied = code === 'microphone-permission-denied';
  const message = permissionDenied
    ? 'If your browser has blocked this site, allow Microphone in site settings first.'
    : code === 'microphone-unavailable'
      ? 'Connect a microphone and check that it is selected in your browser or computer’s sound settings, then try again.'
      : code === 'model-load-failed'
        ? 'The speech model could not load. Check your internet connection, then try again.'
        : code === 'unsupported-environment'
          ? 'This browser cannot run local microphone transcription here. Try an up-to-date browser with microphone support, using HTTPS or localhost.'
          : code === 'cross-origin-isolation-required'
            ? 'This site is missing settings needed for local transcription. Contact the site owner for help.'
            : snapshot.error ||
              inputError?.message ||
              'Microphone setup could not finish. Try again.';
  return { permissionDenied, message };
};

/** Native disclosure keeps permission help available to pointer, touch, and keyboard users. */
export const GalleryMicrophoneRecovery = ({
  failure,
  blocked = false,
  helpClassName = 'gallery-microphone-help',
}: {
  failure: ReturnType<typeof getGalleryMicrophoneFailure>;
  blocked?: boolean;
  helpClassName?: string;
}) => {
  return (
    <>
      <div role="alert">
        {failure.permissionDenied && <strong>Microphone access needed</strong>}
        <p>{failure.message}</p>
        {blocked && <p>Reload this page before trying again.</p>}
      </div>
      {failure.permissionDenied && (
        <details className={helpClassName}>
          <summary>How to enable your microphone</summary>
          <ol>
            <li>Open this site's permissions beside your browser's address bar.</li>
            <li>Set Microphone to Allow, or reset the blocked permission.</li>
            <li>Return here and choose Try microphone again.</li>
          </ol>
          <p>
            Still blocked? Check that your computer's privacy settings allow your browser to use the
            microphone.
          </p>
        </details>
      )}
    </>
  );
};

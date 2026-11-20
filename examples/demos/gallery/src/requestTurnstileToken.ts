import { GalleryModelError } from '../shared/galleryModel';

type Turnstile = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widget: string) => void;
};

/**
 * A fresh widget supplies one token per session-creation attempt; unmount cancels verification.
 */
export const requestTurnstileToken = async ({
  container,
  sitekey,
  action,
  signal,
}: {
  container: HTMLElement;
  sitekey: string;
  action: string;
  signal: AbortSignal;
}) => {
  const browser = window as Window & { turnstile?: Turnstile };
  const lifetime = AbortSignal.any([signal, AbortSignal.timeout(120_000)]);
  const failed = () => new GalleryModelError("We couldn't verify this browser. Try again.");
  lifetime.throwIfAborted();
  if (!browser.turnstile) {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    try {
      await new Promise<void>((resolve, reject) => {
        const abort = () => reject(failed());
        lifetime.addEventListener('abort', abort, { once: true });
        script.onload = () => {
          lifetime.removeEventListener('abort', abort);
          resolve();
        };
        script.onerror = () => {
          lifetime.removeEventListener('abort', abort);
          reject(failed());
        };
        document.head.append(script);
      });
    } finally {
      script.onload = script.onerror = null;
      script.remove();
    }
  }
  lifetime.throwIfAborted();
  const turnstile = browser.turnstile;
  if (!turnstile) throw failed();
  let widget: string | undefined;
  let abort: (() => void) | undefined;
  try {
    return await new Promise<string>((resolve, reject) => {
      abort = () => reject(failed());
      lifetime.addEventListener('abort', abort, { once: true });
      widget = turnstile.render(container, {
        sitekey,
        action,
        appearance: 'interaction-only',
        size: 'compact',
        theme: 'dark',
        retry: 'never',
        'refresh-expired': 'never',
        'refresh-timeout': 'never',
        'response-field': false,
        callback: resolve,
        'error-callback': () => reject(failed()),
        'expired-callback': () => reject(failed()),
        'timeout-callback': () => reject(failed()),
        'unsupported-callback': () => reject(failed()),
      });
    });
  } finally {
    if (abort) lifetime.removeEventListener('abort', abort);
    if (widget !== undefined) turnstile.remove(widget);
  }
};

import { useCallback, useEffect, useId, useState, type RefCallback } from 'react';
import { Check, Copy, SquareTerminal } from 'lucide-react';
import type { galleryDemoDetails } from './galleryDemoDetails';
import { useGalleryEvents } from './galleryEvents';
import './galleryRunLocally.css';

type Demo = (typeof galleryDemoDetails)[number];

/** Demos with their own example directory can be copied; gallery-only demos cannot. */
export const canRunLocally = (demo: Demo): demo is Extract<Demo, { copyDirectory: string }> =>
  'copyDirectory' in demo;

/**
 * The shell commands that copy one demo out of the public repository and start it. `degit`
 * downloads the directory without Git history; a pinned revision matches the demo the visitor
 * just used.
 */
export const runLocallyCommand = (
  demo: Extract<Demo, { copyDirectory: string }>,
  revision?: string
) =>
  [
    `npx degit katabase-ai/katakit/${demo.sourcePath}${revision ? `#${revision}` : ''} ${demo.copyDirectory}`,
    `cd ${demo.copyDirectory}`,
    'pnpm install',
    'pnpm dev',
  ].join('\n');

/** A prompt a coding agent can follow to copy, start, and then extend the demo. */
export const runLocallyPrompt = (
  demo: Extract<Demo, { copyDirectory: string }>,
  revision?: string
) =>
  [
    `Copy the Katakit "${demo.title}" demo and run it on my machine so I can build on it.`,
    '',
    'Run these commands, then give me the local URL the dev server prints:',
    '',
    runLocallyCommand(demo, revision),
    '',
    'It needs Node.js 24 or newer and pnpm.',
    ...((demo.capabilities as readonly string[]).includes('remoteModel')
      ? [
          '',
          'This demo calls a language model with my own API key. Read README.md for how the model connection is configured. Ask me before you read, create, or edit anything that holds an API key.',
        ]
      : []),
    '',
    'When it is running, read README.md and AGENTS.md, then ask me what I want to change.',
  ].join('\n');

const CopyBlock = ({
  label,
  text,
  onCopied,
}: {
  label: string;
  text: string;
  onCopied: () => void;
}) => {
  const id = useId();
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [state]);
  return (
    <div className="gallery-run-locally-block">
      <div className="gallery-run-locally-block-heading">
        <span id={id}>{label}</span>
        <button
          type="button"
          className="gallery-run-locally-copy"
          aria-describedby={id}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
            } catch {
              setState('failed');
              return;
            }
            setState('copied');
            onCopied();
          }}
        >
          {state === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {state === 'copied' ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre aria-labelledby={id}>
        <code>{text}</code>
      </pre>
      {state === 'failed' && (
        <p role="alert">Copying is blocked in this browser. Select the text and copy it instead.</p>
      )}
    </div>
  );
};

/**
 * Copy a demo to your machine: a shell command and a prompt for a coding agent. Demos that call a
 * model say in the panel that running them locally needs your own API key.
 */
export const GalleryRunLocally = ({ demo, revision }: { demo: Demo; revision?: string }) => {
  const events = useGalleryEvents();
  // A pointer press or Escape anywhere outside closes the open panel, as the other popovers do.
  const dismissOutside: RefCallback<HTMLDetailsElement> = useCallback(node => {
    if (!node) return;
    const dismiss = (event: KeyboardEvent | PointerEvent) => {
      if (!node.open) return;
      if (
        event instanceof KeyboardEvent
          ? event.key !== 'Escape'
          : node.contains(event.target as Node)
      )
        return;
      node.open = false;
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', dismiss);
    };
  }, []);
  if (!canRunLocally(demo)) return null;
  const needsKey = (demo.capabilities as readonly string[]).includes('remoteModel');
  return (
    <details ref={dismissOutside} className="gallery-run-locally">
      <summary>
        <SquareTerminal aria-hidden="true" />
        Run locally
      </summary>
      <div className="gallery-run-locally-panel">
        <p>
          <a
            href={`https://github.com/katabase-ai/katakit/tree/${revision ?? 'main'}/${demo.sourcePath}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View example source
          </a>
        </p>
        <CopyBlock
          label="Command"
          text={runLocallyCommand(demo, revision)}
          onCopied={() => events.report({ type: 'runLocallyCopied', content: 'command' })}
        />
        <CopyBlock
          label="Prompt for your coding agent"
          text={runLocallyPrompt(demo, revision)}
          onCopied={() => events.report({ type: 'runLocallyCopied', content: 'prompt' })}
        />
        {needsKey && <p>The demo’s README explains connecting your own model API key.</p>}
      </div>
    </details>
  );
};

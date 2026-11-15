import { lazy, type ComponentType } from 'react';

type DemoBase = { path: string; title: string; description: string };
type ReactDemo = DemoBase & { kind: 'react'; component: ComponentType };
type LandingDemo = DemoBase & { kind: 'landing'; content: ComponentType };
export type Demo = ReactDemo | LandingDemo;

// Landing demos can provide an explanatory page instead of a mounted app.
export const demos: Demo[] = [
  {
    kind: 'react',
    path: '/demos/transcription',
    title: 'Conversation transcription',
    description: 'Record speech and see conversation turns transcribed locally in your browser.',
    component: lazy(async () => {
      const { TranscriptionDemo } = await import('../../transcription-react/src/App');
      return { default: TranscriptionDemo };
    }),
  },
  {
    kind: 'react',
    path: '/demos/bingo',
    title: 'Conversation bingo',
    description: 'Play a live bingo board using on-device microphone transcription.',
    component: lazy(async () => {
      const { BrowserBingoDemo } = await import('../../bingo-react/src/App');
      return { default: BrowserBingoDemo };
    }),
  },
  {
    kind: 'landing',
    path: '/demos/conversation-bingo',
    title: 'Conversation bingo for Chrome',
    description: 'Play bingo with tab and microphone audio in a Chrome extension side panel.',
    content: () => (
      <div>
        <h1>Conversation bingo</h1>
        <p>This demo runs as a Chrome extension, not in the gallery page.</p>
        <p>
          Build the extension with <code>pnpm --filter @katakit/demo-bingo-extension build</code>,
          then load <code>demos/bingo-extension/dist/</code> as an unpacked extension at{' '}
          <code>chrome://extensions</code>.
        </p>
        <p>
          Open a meeting tab, open the extension side panel, and start listening. See{' '}
          <a href="https://github.com/katabase-ai/katakit/tree/main/demos/bingo-extension">
            setup and privacy details
          </a>
          .
        </p>
      </div>
    ),
  },
];

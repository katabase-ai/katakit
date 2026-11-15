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
];

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNav, generateNav } from './generate-nav.mjs';

test('navigation follows the section order and uses directory READMEs as landing pages', () => {
  assert.deepEqual(buildNav(), [
    { label: 'Why Katakit?', slug: 'why-katakit' },
    {
      label: 'Getting started',
      slug: 'getting-started',
      children: [{ label: 'React integration', slug: 'getting-started/react' }],
    },
    {
      label: 'Tutorial',
      slug: 'concepts',
      children: [
        { label: 'Start a runtime', slug: 'concepts/runtime' },
        { label: 'Derive state from events', slug: 'concepts/event-history' },
        { label: 'Add a plugin and an effect', slug: 'concepts/plugins' },
        { label: 'Restore and save history', slug: 'concepts/persistence' },
        { label: 'Connect an input and a view', slug: 'concepts/templates' },
      ],
    },
    {
      label: 'Reference',
      slug: 'reference',
      children: [
        { label: 'Core', slug: 'reference/core' },
        { label: 'Transcription utilities', slug: 'reference/transcription' },
        {
          label: 'Plugins',
          slug: 'reference/plugins',
          children: [
            { label: 'Event log', slug: 'reference/plugins/event-log' },
            { label: 'Persistence', slug: 'reference/plugins/persistence' },
            { label: 'Transcript ingestion', slug: 'reference/plugins/transcript-ingestion' },
          ],
        },
        {
          label: 'Templates',
          slug: 'starters',
          children: [
            { label: 'Build a Chrome extension', slug: 'starters/chrome-extension' },
            { label: 'Build an Electron desktop app', slug: 'starters/electron' },
            { label: 'MCP App card — WIP', slug: 'starters/mcp-app' },
            { label: 'Build an Obsidian plugin', slug: 'starters/obsidian' },
            { label: 'Build a React web app', slug: 'starters/react-web' },
          ],
        },
      ],
    },
  ]);
});

test('checked-in navigation is current', () => {
  assert.doesNotThrow(() => generateNav({ check: true }));
});

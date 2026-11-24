import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNav, generateNav } from './generate-nav.mjs';

test('navigation follows the section order and uses directory READMEs as landing pages', () => {
  assert.deepEqual(buildNav(), [
    { label: 'Why Katakit?', slug: 'why-katakit' },
    {
      label: 'Quickstart',
      slug: 'getting-started',
      children: [],
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
      label: 'Application Starters',
      slug: 'starters',
      children: [
        { label: 'React', slug: 'starters/react-web' },
        { label: 'Chrome extension', slug: 'starters/chrome-extension' },
        { label: 'Electron', slug: 'starters/electron' },
        { label: 'Obsidian', slug: 'starters/obsidian' },
        { label: 'MCP App (WIP)', slug: 'starters/mcp-app' },
      ],
    },
    {
      label: 'Reference',
      slug: 'reference',
      children: [
        { label: '@katakit/core', slug: 'reference/core' },
        { label: '@katakit/event-log', slug: 'reference/plugins/event-log' },
        { label: '@katakit/persistence', slug: 'reference/plugins/persistence' },
        { label: '@katakit/react', slug: 'reference/react' },
        { label: '@katakit/transcript-ingestion', slug: 'reference/plugins/transcript-ingestion' },
        { label: '@katakit/transcription', slug: 'reference/transcription' },
      ],
    },
  ]);
});

test('checked-in navigation is current', () => {
  assert.doesNotThrow(() => generateNav({ check: true }));
});

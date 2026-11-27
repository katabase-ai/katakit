import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNav, generateNav } from './generate-nav.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import GithubSlugger from 'github-slugger';

test('legacy event-sourcing section anchors lead to their relocated sections', () => {
  const pages = fileURLToPath(new URL('../pages/', import.meta.url));
  for (const [oldPage, newPage, headings] of [
    [
      'reference/event-sourcing.md',
      'event-sourcing/designing.md',
      [
        'Designing event-sourced applications',
        'Start with behavior',
        'Choose facts that preserve meaning',
        'Give each value one authority',
        'Make replay sufficient and deterministic',
        'Choose session boundaries deliberately',
        'Own live work and shutdown',
        'Verify the design',
      ],
    ],
    [
      'getting-started/migrate-to-event-sourcing.md',
      'event-sourcing/migration.md',
      [
        'Migrate an existing application',
        '1. Inventory behavior and state',
        '2. Design the facts before adapting the frontend',
        '3. Connect the model to Katakit',
        '4. Decide what happens to existing data',
        '5. Separate replay from live work',
        '6. Prove the cutover',
        'Use an agent',
      ],
    ],
  ]) {
    const legacy = readFileSync(`${pages}${oldPage}`, 'utf8');
    const current = readFileSync(`${pages}${newPage}`, 'utf8');
    const slugs = new GithubSlugger();
    for (const [index, heading] of headings.entries()) {
      const anchor = slugs.slug(heading);
      const prefix = index === 0 ? '# ' : '## ';
      assert.ok(legacy.includes(`${prefix}${heading}\n`), `${oldPage} lost #${anchor}`);
      assert.ok(current.includes(`${prefix}${heading}\n`), `${newPage} lost #${anchor}`);
      if (index > 0) assert.ok(legacy.includes(`../${newPage}#${anchor}`));
    }
  }
});

test('navigation follows the section order and uses directory READMEs as landing pages', () => {
  assert.deepEqual(buildNav(), [
    { label: 'Why Katakit?', slug: 'why-katakit' },
    { label: 'Quickstart', slug: 'getting-started', children: [] },
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
      label: 'Event Sourcing',
      slug: 'event-sourcing',
      children: [
        { label: 'Designing event-sourced applications', slug: 'event-sourcing/designing' },
        {
          label: 'Event-sourcing implementation standards',
          slug: 'event-sourcing/implementation-standards',
        },
        { label: 'Migrate an existing application', slug: 'event-sourcing/migration' },
      ],
    },
    {
      label: 'Application starters',
      slug: 'starters',
      children: [
        { label: 'React', slug: 'starters/react-web' },
        { label: 'Chrome extension', slug: 'starters/chrome-extension' },
        { label: 'Electron', slug: 'starters/electron' },
        { label: 'Obsidian', slug: 'starters/obsidian' },
      ],
    },
    {
      label: 'Contributing',
      slug: 'contributing',
      children: [{ label: 'Authoring and hosting gallery demos', slug: 'contributing/gallery' }],
    },
    {
      label: 'Reference',
      slug: 'reference',
      children: [
        { label: '@katakit/core', slug: 'reference/core' },
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

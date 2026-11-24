// @vitest-environment happy-dom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Gallery } from './Gallery';
import {
  bingoDemoDetails,
  brainstormDemoDetails,
  colorClashDemoDetails,
  listExtractionDemoDetails,
  notesDemoDetails,
  transcriptionDemoDetails,
} from './galleryDemoDetails';

afterEach(cleanup);

const renderNavigation = (demos: Parameters<typeof Gallery>[0]['demos']) =>
  render(
    <Gallery
      demos={demos}
      activeDemo={bingoDemoDetails}
      renderLink={({ demo, children, current }) => (
        <a href={demo ? `/demos/${demo.id}` : '/'} aria-current={current ? 'page' : undefined}>
          {children}
        </a>
      )}
    />
  );

test('groups selected demos in section order, preserving host order and the active link', () => {
  renderNavigation([
    notesDemoDetails,
    brainstormDemoDetails,
    bingoDemoDetails,
    transcriptionDemoDetails,
    colorClashDemoDetails,
    listExtractionDemoDetails,
  ]);
  const nav = screen.getByRole('navigation', { name: 'React demos' });
  const groups = within(nav).getAllByRole('group');
  expect(groups.map(group => group.getAttribute('aria-label'))).toEqual([
    'Basics',
    'Games',
    'Meetings',
  ]);
  expect(
    within(nav)
      .getAllByRole('link')
      .map(link => link.textContent)
  ).toEqual([
    'Welcome',
    'Transcription',
    'Word rush',
    'Bingo',
    'Color clash',
    'Structured notes',
    'List extraction',
  ]);
  expect(within(nav).getByRole('link', { name: 'Bingo' }).getAttribute('aria-current')).toBe(
    'page'
  );
});

test('omits empty sections and never shows demos the host did not select', () => {
  renderNavigation([bingoDemoDetails]);
  const nav = screen.getByRole('navigation', { name: 'React demos' });
  expect(
    within(nav)
      .getAllByRole('group')
      .map(group => group.getAttribute('aria-label'))
  ).toEqual(['Games']);
  expect(
    within(nav)
      .getAllByRole('link')
      .map(link => link.textContent)
  ).toEqual(['Welcome', 'Bingo']);
});

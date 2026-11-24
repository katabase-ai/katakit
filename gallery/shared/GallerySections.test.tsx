// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Gallery } from './Gallery';
import { galleryDemoDetails } from './galleryDemoDetails';

afterEach(cleanup);

const renderGallery = (demos = [...galleryDemoDetails]) =>
  render(
    <Gallery
      demos={demos}
      activeSection="Meetings"
      renderLink={({ demo, children, current }) => (
        <a href={demo ? `/demos/${demo.id}` : '/'} aria-current={current ? 'page' : undefined}>
          {children}
        </a>
      )}
      renderSectionLink={({ section, children, current }) => (
        <a href={`/sections/${section.toLowerCase()}`} aria-current={current ? 'page' : undefined}>
          {children}
        </a>
      )}
    />
  );

test('section pages list only selected demos and mark their own navigation link current', () => {
  const { container } = renderGallery(
    galleryDemoDetails.filter(demo => demo.id !== 'list-extraction')
  );
  const navigation = screen.getByRole('navigation', { name: 'React demos' });
  expect(
    within(navigation).getByRole('link', { name: 'Meetings' }).getAttribute('aria-current')
  ).toBe('page');
  expect(
    within(navigation).getByRole('link', { name: 'Welcome' }).hasAttribute('aria-current')
  ).toBe(false);
  expect(screen.getByRole('heading', { name: 'Meetings' })).toBeDefined();
  const content = container.querySelector('.gallery-content') as HTMLElement;
  expect(
    within(content)
      .getAllByRole('link')
      .map(link => link.textContent)
  ).toEqual(['Structured notes']);
});

test('disclosures hide only their own children and leave section links and page content accessible', () => {
  renderGallery();
  const navigation = screen.getByRole('navigation', { name: 'React demos' });
  const toggle = within(navigation).getByRole('button', { name: 'Hide Meetings demos' });
  const children = document.getElementById(toggle.getAttribute('aria-controls')!);
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(children?.hidden).toBe(true);
  expect(within(navigation).queryByRole('link', { name: 'Structured notes' })).toBeNull();
  expect(within(navigation).getByRole('link', { name: 'Meetings' })).toBeDefined();
  expect(within(navigation).getByRole('link', { name: 'Bingo' })).toBeDefined();
  expect(screen.getByRole('link', { name: 'Structured notes' })).toBeDefined();
  fireEvent.click(within(navigation).getByRole('button', { name: 'Show Meetings demos' }));
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(children?.hidden).toBe(false);
  expect(within(navigation).getByRole('link', { name: 'Structured notes' })).toBeDefined();
});

test('unpublished sections have neither navigation links nor toggles', () => {
  renderGallery(galleryDemoDetails.filter(demo => demo.section === 'Meetings'));
  const navigation = screen.getByRole('navigation', { name: 'React demos' });
  expect(within(navigation).queryByRole('link', { name: 'Games' })).toBeNull();
  expect(within(navigation).queryByRole('button', { name: 'Hide Games demos' })).toBeNull();
});

import { isRedirect } from '@tanstack/react-router';
import { expect, test } from 'vitest';
import { Route } from './demos.$demoId';

test('old Brainstorm links redirect to the Word rush gallery URL', () => {
  let redirected: unknown;
  try {
    const loader = Route.options.loader as (input: { params: { demoId: string } }) => unknown;
    loader({ params: { demoId: 'brainstorm' } });
  } catch (error) {
    redirected = error;
  }
  expect(isRedirect(redirected)).toBe(true);
  expect(redirected).toMatchObject({
    options: { to: '/demos/$demoId', params: { demoId: 'word-rush' } },
  });
});

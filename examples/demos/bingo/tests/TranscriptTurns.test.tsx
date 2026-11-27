import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { TranscriptTurns } from '../src/ui/TranscriptTurns';

test('renders completed turns newest first, with pending and provisional text', () => {
  const html = renderToStaticMarkup(
    <TranscriptTurns
      completed={[{ id: 'first', text: 'First', startMs: 1000 }]}
      current={{ text: 'Still speaking', startMs: 2000 }}
      provisional="Next words"
    />
  );
  expect(html.indexOf('Next words')).toBeLessThan(html.indexOf('Still speaking'));
  expect(html.indexOf('Still speaking')).toBeLessThan(html.indexOf('First'));
  expect(html).toContain('02</span>');
  expect(html).toContain('01</span>');
  expect(html).toContain('00:02');
  expect(html).toContain('00:01');
});

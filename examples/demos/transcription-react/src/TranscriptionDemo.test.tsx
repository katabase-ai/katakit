// @vitest-environment happy-dom
import { act, render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createTranscriptionDemo } from './createTranscriptionDemo';
import { TranscriptionDemo } from './TranscriptionDemo';

it('renders restored and immediate segments once across flush and reset', () => {
  const runtime = createTranscriptionDemo({
    initialEvents: [
      {
        type: 'segment',
        segment: { id: '1', sourceId: 'import', text: 'Restored words', startMs: 12000 },
      },
    ],
  });
  const view = render(<TranscriptionDemo runtime={runtime} />);
  expect(view.getAllByText('Restored words')).toHaveLength(1);
  expect(view.getByText('00:12')).toBeTruthy();
  act(() => runtime.ingestSegment({ id: '2', sourceId: 'import', text: 'continued' }));
  expect(view.getAllByText('Restored words continued')).toHaveLength(1);
  act(() => runtime.flush());
  expect(view.getAllByText('Restored words continued')).toHaveLength(1);
  expect(view.queryByText('Turn in progress')).toBeNull();
  act(() => runtime.reset());
  expect(view.getByText('Your conversation will appear here.')).toBeTruthy();
  view.unmount();
  runtime.close();
});

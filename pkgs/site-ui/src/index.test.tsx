import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button, Notice, SelectField } from './index';

describe('site UI primitives', () => {
  it('uses native button semantics and exposes disabled state', () => {
    const html = renderToStaticMarkup(
      <Button variant="blue" disabled>
        Start
      </Button>
    );
    expect(html).toContain('type="button"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('site-button--blue');
  });

  it('associates a select with its label and hint', () => {
    const html = renderToStaticMarkup(
      <SelectField id="model" label="Model" hint="Choose between recordings">
        <option value="tiny">Tiny</option>
      </SelectField>
    );
    expect(html).toContain('for="model"');
    expect(html).toContain('aria-describedby="model-hint"');
    expect(html).toContain('id="model-hint"');
  });

  it('announces errors and associates them with the select', () => {
    const html = renderToStaticMarkup(
      <>
        <Notice tone="error">No microphone</Notice>
        <SelectField id="input" label="Input" error="Required">
          <option>Mic</option>
        </SelectField>
      </>
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="input-error"');
  });
});

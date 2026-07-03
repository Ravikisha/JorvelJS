import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Card,
  Input,
  Modal,
  storybookFiles,
  storybookScripts,
  storybookDevDeps,
} from '../src/index.js';

describe('Input', () => {
  it('renders a bare input when no label or errorText', () => {
    const html = renderToStaticMarkup(<Input placeholder="Email" />);
    expect(html.startsWith('<input')).toBe(true);
    expect(html).toContain('placeholder="Email"');
  });

  it('wraps in a <label> when label is supplied', () => {
    const html = renderToStaticMarkup(<Input label="Email" />);
    expect(html).toContain('<label');
    expect(html).toContain('Email');
  });

  it('renders aria-invalid + error message when errorText supplied', () => {
    const html = renderToStaticMarkup(<Input label="Email" errorText="bad" />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('bad');
  });

  it('size respects sm/md/lg', () => {
    const sm = renderToStaticMarkup(<Input size="sm" />);
    expect(sm).toContain('font-size:0.875rem');
    const lg = renderToStaticMarkup(<Input size="lg" />);
    expect(lg).toContain('font-size:1.125rem');
  });

  it('escapes dangerous attribute values', () => {
    const html = renderToStaticMarkup(<Input placeholder={'"><script>x()</script>'} />);
    expect(html).not.toContain('<script>');
  });
});

describe('Modal', () => {
  it('renders null when open is false', () => {
    const html = renderToStaticMarkup(<Modal open={false} onClose={() => {}} />);
    expect(html).toBe('');
  });

  it('renders dialog with aria attrs when open', () => {
    const html = renderToStaticMarkup(
      <Modal open onClose={() => {}} ariaLabel="confirm">
        <p>body</p>
      </Modal>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="confirm"');
    expect(html).toContain('body');
  });

  it('uses aria-labelledby when provided', () => {
    const html = renderToStaticMarkup(
      <Modal open onClose={() => {}} ariaLabelledBy="title-1">
        <h2 id="title-1">Title</h2>
      </Modal>,
    );
    expect(html).toContain('aria-labelledby="title-1"');
  });
});

describe('Card', () => {
  it('outline variant has a border', () => {
    const html = renderToStaticMarkup(<Card>body</Card>);
    expect(html).toContain('border:1px solid');
    expect(html).not.toContain('box-shadow');
  });

  it('elevated variant uses box-shadow', () => {
    const html = renderToStaticMarkup(<Card variant="elevated">body</Card>);
    expect(html).toContain('box-shadow');
  });

  it('padding switch flows into inline style', () => {
    expect(renderToStaticMarkup(<Card padding="sm" />)).toContain('padding:8px');
    expect(renderToStaticMarkup(<Card padding="lg" />)).toContain('padding:24px');
  });
});

describe('storybook scaffold', () => {
  it('emits the expected files', () => {
    const files = storybookFiles();
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(
      [
        '.storybook/main.ts',
        '.storybook/preview.ts',
        'libs/ui/stories/Button.stories.tsx',
        'libs/ui/stories/Card.stories.tsx',
        'libs/ui/stories/Input.stories.tsx',
        'libs/ui/stories/Modal.stories.tsx',
        'libs/ui/stories/Toast.stories.tsx',
      ].sort(),
    );
  });

  it('main.ts globs the stories under libs/ui/stories (where they are written)', () => {
    const main = storybookFiles().find((f) => f.path === '.storybook/main.ts')!;
    expect(main.contents).toContain("'../libs/ui/stories/**/*.stories.@(ts|tsx)'");
    // Stories live in stories/, NOT src/ — the glob must match.
    const storyPaths = storybookFiles().filter((f) => f.path.endsWith('.stories.tsx'));
    expect(storyPaths.every((f) => f.path.startsWith('libs/ui/stories/'))).toBe(true);
  });

  it('preview.ts wraps stories in ThemeProvider', () => {
    const preview = storybookFiles().find((f) => f.path === '.storybook/preview.ts')!;
    expect(preview.contents).toContain('ThemeProvider');
  });

  it('exposes recommended npm scripts + devDeps', () => {
    expect(storybookScripts.storybook).toContain('storybook dev');
    expect(storybookScripts['build-storybook']).toContain('storybook build');
    expect(storybookDevDeps.storybook).toMatch(/^\^8/);
  });
});

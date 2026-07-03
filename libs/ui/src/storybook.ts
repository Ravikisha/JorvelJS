/**
 * Storybook scaffold — pure file emitter. The CLI command `jorvel ui storybook`
 * (and any equivalent build script) uses this to drop a working Storybook
 * configuration into a workspace without us taking a dependency on Storybook
 * at install time.
 */

export interface StorybookFile {
  /** Relative path under the storybook root. */
  path: string;
  contents: string;
}

const MAIN = `// .storybook/main.ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../libs/ui/stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  docs: { autodocs: 'tag' },
};

export default config;
`;

const PREVIEW = `// .storybook/preview.ts
import React from 'react';
import { ThemeProvider } from '@jorvel/ui';

export const decorators = [
  (Story: () => React.ReactNode) => React.createElement(ThemeProvider, null, Story()),
];

export const parameters = {
  layout: 'centered',
  controls: { expanded: true },
};
`;

const BUTTON_STORY = `import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../src/Button';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Button>;
export default meta;

export const Primary: StoryObj<typeof meta> = { args: { children: 'Save', variant: 'primary' } };
export const Secondary: StoryObj<typeof meta> = { args: { children: 'Cancel', variant: 'secondary' } };
export const Ghost: StoryObj<typeof meta> = { args: { children: 'More', variant: 'ghost' } };
`;

const INPUT_STORY = `import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '../src/Input';

const meta = {
  title: 'Primitives/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: { size: { control: 'select', options: ['sm', 'md', 'lg'] } },
} satisfies Meta<typeof Input>;
export default meta;

export const Basic: StoryObj<typeof meta> = { args: { placeholder: 'Email…' } };
export const WithLabel: StoryObj<typeof meta> = {
  args: { label: 'Email', placeholder: 'you@example.com' },
};
export const Invalid: StoryObj<typeof meta> = {
  args: { label: 'Email', value: 'broken', errorText: 'Invalid email' },
};
`;

const CARD_STORY = `import type { Meta, StoryObj } from '@storybook/react';
import { Card } from '../src/Card';

const meta = {
  title: 'Primitives/Card',
  component: Card,
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;
export default meta;

export const Outline: StoryObj<typeof meta> = {
  args: { variant: 'outline', children: 'Outlined card' },
};
export const Elevated: StoryObj<typeof meta> = {
  args: { variant: 'elevated', children: 'Elevated card' },
};
`;

const MODAL_STORY = `import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Modal } from '../src/Modal';
import { Button } from '../src/Button';

const meta = {
  title: 'Primitives/Modal',
  component: Modal,
  tags: ['autodocs'],
} satisfies Meta<typeof Modal>;
export default meta;

export const Toggle: StoryObj<typeof meta> = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open</Button>
        <Modal open={open} onClose={() => setOpen(false)} ariaLabel="demo">
          <h2>Modal title</h2>
          <p>Press ESC or click the overlay to close.</p>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </Modal>
      </>
    );
  },
};
`;

const TOAST_STORY = `import type { Meta, StoryObj } from '@storybook/react';
import { Button, ToastProvider, useToast } from '../src/index';

const meta = {
  title: 'Primitives/Toast',
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

function Demo() {
  const toast = useToast();
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button onClick={() => toast.push({ message: 'Saved!', variant: 'success' })}>Success</Button>
      <Button onClick={() => toast.push({ message: 'Heads up', variant: 'warn' })}>Warn</Button>
      <Button onClick={() => toast.push({ message: 'Failed', variant: 'error', durationMs: 6000 })}>Error</Button>
    </div>
  );
}

export const Variants: StoryObj = {
  render: () => (
    <ToastProvider>
      <Demo />
    </ToastProvider>
  ),
};
`;

/**
 * Return the canonical list of files a Storybook scaffold writes. Pure — useful
 * for tests that check expected filenames + key content fragments.
 */
export function storybookFiles(): StorybookFile[] {
  return [
    { path: '.storybook/main.ts', contents: MAIN },
    { path: '.storybook/preview.ts', contents: PREVIEW },
    { path: 'libs/ui/stories/Button.stories.tsx', contents: BUTTON_STORY },
    { path: 'libs/ui/stories/Input.stories.tsx', contents: INPUT_STORY },
    { path: 'libs/ui/stories/Card.stories.tsx', contents: CARD_STORY },
    { path: 'libs/ui/stories/Modal.stories.tsx', contents: MODAL_STORY },
    { path: 'libs/ui/stories/Toast.stories.tsx', contents: TOAST_STORY },
  ];
}

/**
 * Minimal NPM scripts the user needs to wire up to run Storybook after
 * scaffolding. Returned as a `{ name → command }` map so the CLI can merge
 * into the workspace `package.json`.
 */
export const storybookScripts: Record<string, string> = {
  storybook: 'storybook dev -p 6006',
  'build-storybook': 'storybook build',
};

/** Storybook devDependencies the scaffolder hints at adding. */
export const storybookDevDeps: Record<string, string> = {
  storybook: '^8.0.0',
  '@storybook/react-vite': '^8.0.0',
  '@storybook/addon-essentials': '^8.0.0',
  '@storybook/addon-a11y': '^8.0.0',
  vite: '^5.0.0',
};

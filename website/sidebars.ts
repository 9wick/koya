import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'introduction',
    {
      type: 'category',
      label: 'Overview',
      items: ['first-steps', 'controllers', 'services', 'middleware'],
    },
    {
      type: 'category',
      label: 'Fundamentals',
      items: ['modules', 'dependency-injection', 'primitives', 'testing'],
    },
    {
      type: 'category',
      label: 'Techniques',
      items: ['authentication', 'validation', 'error-handling', 'configuration', 'command'],
    },
    {
      type: 'category',
      label: 'Client Integration',
      items: ['hono-client', 'openapi'],
    },
  ],
};

export default sidebars;

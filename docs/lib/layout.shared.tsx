import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'granter',
      url: '/',
    },
    links: [
      {
        text: 'Documentation',
        url: '/docs',
        active: 'nested-url',
      },
      {
        text: 'GitHub',
        url: 'https://github.com/seeden/whocan',
        external: true,
      },
      {
        text: 'npm',
        url: 'https://www.npmjs.com/package/granter',
        external: true,
      },
    ],
  };
}

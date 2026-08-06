import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import {
  testerInterestOpen,
  testerProgramPath,
  testerProgramSource,
} from './src/domain/testerPublicationGate';

// Publication gate for external tester recruitment.
//
// The application default is closed. In that state the docs plugin excludes
// the tester page at its source boundary, so Docusaurus cannot create a route
// or pass its content to sitemap and local-search plugins. Navigation and
// promotional surfaces are gated separately below.
const defaultDocsExclude = [
  '**/_*.{js,jsx,ts,tsx,md,mdx}',
  '**/_*/**',
  '**/*.test.{js,jsx,ts,tsx}',
  '**/__tests__/**',
];
const testerDocsExclude = testerInterestOpen
  ? defaultDocsExclude
  : [...defaultDocsExclude, testerProgramSource];

const testerAnnouncementBar = testerInterestOpen
  ? {
      id: 'tester-interest',
      content:
        `🧪 Ferrite tester intake is open — <a href="${testerProgramPath}">read the program and register interest</a>.`,
      backgroundColor: '#b7410e',
      textColor: '#ffffff',
      isCloseable: true,
    }
  : undefined;

const testerNavbarItems = testerInterestOpen
  ? [{to: testerProgramPath, label: 'Test Ferrite', position: 'left' as const}]
  : [];

const testerFooterItems = testerInterestOpen
  ? [
      {
        label: 'Tester Interest & Questions',
        href: 'https://github.com/ferritelabs/ferrite/issues/new/choose',
      },
    ]
  : [];

const config: Config = {
  title: 'Ferrite',
  tagline: 'The speed of memory, the capacity of disk, the economics of cloud',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  themes: [
    '@docusaurus/theme-mermaid',
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['en'],
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
        docsRouteBasePath: '/docs',
        blogRouteBasePath: '/blog',
        indexBlog: true,
        indexDocs: true,
        indexPages: true,
      },
    ],
  ],

  // Production URL
  url: 'https://ferrite.dev',
  baseUrl: '/',

  // GitHub pages deployment config
  organizationName: 'ferritelabs',
  projectName: 'ferrite',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'warn',
  onDuplicateRoutes: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  headTags: [
    {
      tagName: 'link',
      attributes: {
        rel: 'manifest',
        href: '/manifest.json',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        property: 'og:type',
        content: 'website',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        name: 'theme-color',
        content: '#b7410e',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        name: 'keywords',
        content: 'ferrite, redis, key-value store, rust, database, in-memory, cache, high-performance',
      },
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          exclude: testerDocsExclude,
          editUrl: 'https://github.com/ferritelabs/ferrite-docs/tree/main/website/',
          lastVersion: 'current',
          versions: {
            current: {
              label: 'v0.4',
              path: '',
            },
            '0.2': {
              label: 'v0.2',
              path: '0.2',
              banner: 'unmaintained',
            },
          },
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl: 'https://github.com/ferritelabs/ferrite-docs/tree/main/website/',
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
        sitemap: {
          lastmod: 'date',
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: testerInterestOpen
            ? ['/tags/**']
            : ['/tags/**', testerProgramPath],
          filename: 'sitemap.xml',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Configure Algolia DocSearch — credentials pending registration:
    // algolia: {
    //   appId: 'YOUR_APP_ID',
    //   apiKey: 'YOUR_SEARCH_API_KEY',
    //   indexName: 'ferrite',
    // },
    ...(testerAnnouncementBar ? {announcementBar: testerAnnouncementBar} : {}),
    image: 'img/ferrite-social-card.svg',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    mermaid: {
      theme: {light: 'neutral', dark: 'dark'},
    },
    navbar: {
      title: 'Ferrite',
      logo: {
        alt: 'Ferrite Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {to: '/benchmarks', label: 'Benchmarks', position: 'left'},
        {to: '/cost-calculator', label: 'Cost Calculator', position: 'left'},
        {to: '/playground', label: 'Playground', position: 'left'},
        {to: '/blog', label: 'Blog', position: 'left'},
        ...testerNavbarItems,
        {
          href: 'https://docs.rs/ferrite',
          label: 'API',
          position: 'left',
        },
        {
          href: 'https://github.com/ferritelabs/ferrite',
          label: 'GitHub',
          position: 'right',
        },
        {
          type: 'docsVersionDropdown',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started/installation',
            },
            {
              label: 'Guides',
              to: '/docs/guides/embedded-mode',
            },
            {
              label: 'API Reference',
              href: 'https://docs.rs/ferrite',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            ...testerFooterItems,
            {
              label: 'Discord',
              href: 'https://discord.gg/ferrite',
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/ferrite_rs',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: '/blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/ferritelabs/ferrite',
            },
            {
              label: 'Benchmarks',
              to: '/benchmarks',
            },
            {
              label: 'Playground',
              to: '/playground',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Ferrite Contributors. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['rust', 'toml', 'bash', 'json', 'sql', 'python', 'typescript', 'go', 'java', 'kotlin', 'swift', 'elixir', 'csharp', 'php', 'ruby'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Ferrite',
  tagline: 'The speed of memory, the capacity of disk, the economics of cloud',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  markdown: {
    mermaid: true,
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

  // Production URL - update this when deploying
  url: 'https://ferrite.rs',
  baseUrl: '/',

  // GitHub pages deployment config
  organizationName: 'ferrite-rs',
  projectName: 'ferrite',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'warn',
  onBrokenMarkdownLinks: 'warn',
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
          editUrl: 'https://github.com/ferrite-rs/ferrite/tree/main/website/',
          // Versioned docs: v0.3 and v0.4 defined under website/versioned_docs/
          lastVersion: 'current',
          versions: {
            current: {
              label: 'v0.4 (Next)',
              path: '',
            },
            '0.3': {
              label: 'v0.3',
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
          editUrl: 'https://github.com/ferrite-rs/ferrite/tree/main/website/',
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
          ignorePatterns: ['/tags/**'],
          filename: 'sitemap.xml',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Configure Algolia DocSearch when ready:
    // algolia: {
    //   appId: 'YOUR_APP_ID',
    //   apiKey: 'YOUR_SEARCH_API_KEY',
    //   indexName: 'ferrite',
    // },
    announcementBar: {
      id: 'announcement',
      content:
        '⭐️ If you like Ferrite, give it a star on <a target="_blank" rel="noopener noreferrer" href="https://github.com/ferrite-rs/ferrite">GitHub</a>!',
      backgroundColor: '#b7410e',
      textColor: '#ffffff',
      isCloseable: true,
    },
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
        {
          href: 'https://docs.rs/ferrite',
          label: 'API',
          position: 'left',
        },
        {
          href: 'https://github.com/ferrite-rs/ferrite',
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
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/ferrite-rs/ferrite/discussions',
            },
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
              href: 'https://github.com/ferrite-rs/ferrite',
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

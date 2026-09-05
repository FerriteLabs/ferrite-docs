import {afterEach, describe, expect, it, vi} from 'vitest';

const CONFIG_MODULE = '../../docusaurus.config';
const SIDEBARS_MODULE = '../../sidebars';

type NavbarItem = {label?: string; to?: string; href?: string};
type FooterItem = {label?: string; to?: string; href?: string};

type TesterThemeConfig = {
  announcementBar?: {id?: string; content?: string};
  navbar: {items: NavbarItem[]};
  footer: {links: {title?: string; items: FooterItem[]}[]};
};

type ClassicOptions = {
  docs: {exclude?: string[]};
  sitemap: {ignorePatterns?: string[]};
};

type SiteConfig = {
  presets: unknown[];
  themeConfig: TesterThemeConfig;
};

type PublicationState = {
  config: SiteConfig;
  sidebars: unknown;
};

const TESTER_DOC_ID = 'community/tester-program';
const TESTER_SOURCE = `${TESTER_DOC_ID}.md`;
const TESTER_PAGE_PATH = `/docs/${TESTER_DOC_ID}`;

async function loadPublicationState(value?: string): Promise<PublicationState> {
  vi.resetModules();
  if (value === undefined) {
    delete process.env.TESTER_INTEREST_OPEN;
  } else {
    process.env.TESTER_INTEREST_OPEN = value;
  }

  const [configModule, sidebarsModule] = await Promise.all([
    import(CONFIG_MODULE),
    import(SIDEBARS_MODULE),
  ]);

  return {
    config: configModule.default as unknown as SiteConfig,
    sidebars: sidebarsModule.default,
  };
}

function classicOptions(config: SiteConfig): ClassicOptions {
  const classicPreset = config.presets.find(
    (preset) => Array.isArray(preset) && preset[0] === 'classic',
  );
  expect(classicPreset).toBeDefined();
  return (classicPreset as ['classic', ClassicOptions])[1];
}

function navbarLabels(themeConfig: TesterThemeConfig): string[] {
  return themeConfig.navbar.items.map((item) => item.label ?? '');
}

function footerItems(themeConfig: TesterThemeConfig): FooterItem[] {
  return themeConfig.footer.links.flatMap((section) => section.items);
}

afterEach(() => {
  delete process.env.TESTER_INTEREST_OPEN;
  vi.resetModules();
});

describe('tester publication gate', () => {
  it('defaults closed at every Docusaurus exposure boundary', async () => {
    const {config, sidebars} = await loadPublicationState();
    const options = classicOptions(config);

    expect(options.docs.exclude).toContain(TESTER_SOURCE);
    expect(JSON.stringify(sidebars)).not.toContain(TESTER_DOC_ID);
    expect(options.sitemap.ignorePatterns).toContain(TESTER_PAGE_PATH);

    const themeConfig = config.themeConfig;
    expect(themeConfig.announcementBar).toBeUndefined();
    expect(navbarLabels(themeConfig)).not.toContain('Test Ferrite');
    expect(
      themeConfig.navbar.items.some((item) => item.to === TESTER_PAGE_PATH),
    ).toBe(false);
    expect(
      footerItems(themeConfig).some((item) =>
        /tester/i.test(item.label ?? ''),
      ),
    ).toBe(false);

    // Source exclusion prevents the docs plugin from creating a route for
    // sitemap generation or passing the document to local search.
    expect(JSON.stringify(themeConfig)).not.toMatch(/tester/i);
  });

  it('includes the source, sidebar, sitemap route, and CTAs when open', async () => {
    const {config, sidebars} = await loadPublicationState('true');
    const options = classicOptions(config);

    expect(options.docs.exclude).not.toContain(TESTER_SOURCE);
    expect(JSON.stringify(sidebars)).toContain(TESTER_DOC_ID);
    expect(options.sitemap.ignorePatterns).not.toContain(TESTER_PAGE_PATH);

    const themeConfig = config.themeConfig;
    const announcement = themeConfig.announcementBar;
    expect(announcement).toBeDefined();
    expect(announcement?.content).toMatch(/tester intake is open/i);
    expect(announcement?.content).toContain(TESTER_PAGE_PATH);
    expect(announcement?.content).not.toMatch(/has not started/i);

    expect(navbarLabels(themeConfig)).toContain('Test Ferrite');
    expect(
      themeConfig.navbar.items.some((item) => item.to === TESTER_PAGE_PATH),
    ).toBe(true);
    expect(
      footerItems(themeConfig).some(
        (item) => item.label === 'Tester Interest & Questions',
      ),
    ).toBe(true);
  });

  it('opens the gate only for an exact "true" value', async () => {
    for (const value of ['', 'false', 'TRUE', '1', 'yes']) {
      const {config, sidebars} = await loadPublicationState(value);
      const options = classicOptions(config);

      expect(
        options.docs.exclude,
        `TESTER_INTEREST_OPEN="${value}" must not open the gate`,
      ).toContain(TESTER_SOURCE);
      expect(JSON.stringify(sidebars)).not.toContain(TESTER_DOC_ID);
      expect(config.themeConfig.announcementBar).toBeUndefined();
    }
  });

  it('keeps unrelated navigation unchanged across gate states', async () => {
    const closed = (await loadPublicationState()).config.themeConfig;
    const open = (await loadPublicationState('true')).config.themeConfig;

    expect(
      navbarLabels(open).filter((label) => label !== 'Test Ferrite'),
    ).toEqual(navbarLabels(closed));
    expect(
      footerItems(open)
        .map((item) => item.label)
        .filter((label) => label !== 'Tester Interest & Questions'),
    ).toEqual(footerItems(closed).map((item) => item.label));
  });
});

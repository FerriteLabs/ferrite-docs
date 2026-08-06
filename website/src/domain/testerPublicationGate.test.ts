import {afterEach, describe, expect, it, vi} from 'vitest';

/**
 * The documentation site must not recruit external testers until the campaign
 * can actually be acted on: the core intake and ops tooling must be merged and
 * a clean-machine preflight must pass. That is enforced by the
 * TESTER_INTEREST_OPEN publication gate in docusaurus.config.ts, so the
 * default build has to be provably free of any live tester call to action.
 */

const CONFIG_MODULE = '../../docusaurus.config';

type NavbarItem = {label?: string; to?: string; href?: string};
type FooterItem = {label?: string; to?: string; href?: string};

type TesterThemeConfig = {
  announcementBar?: {id?: string; content?: string};
  navbar: {items: NavbarItem[]};
  footer: {links: {title?: string; items: FooterItem[]}[]};
};

const TESTER_PAGE_PATH = '/docs/community/tester-program';

async function loadThemeConfig(value?: string): Promise<TesterThemeConfig> {
  vi.resetModules();
  if (value === undefined) {
    delete process.env.TESTER_INTEREST_OPEN;
  } else {
    process.env.TESTER_INTEREST_OPEN = value;
  }
  const module = await import(CONFIG_MODULE);
  return module.default.themeConfig as unknown as TesterThemeConfig;
}

function navbarLabels(themeConfig: TesterThemeConfig): string[] {
  return themeConfig.navbar.items.map((item) => item.label ?? '');
}

function footerItems(themeConfig: TesterThemeConfig): FooterItem[] {
  return themeConfig.footer.links.flatMap((section) => section.items);
}

function serialize(themeConfig: TesterThemeConfig): string {
  return JSON.stringify(themeConfig);
}

afterEach(() => {
  delete process.env.TESTER_INTEREST_OPEN;
  vi.resetModules();
});

describe('tester publication gate', () => {
  it('shows no tester call to action in the default build', async () => {
    const themeConfig = await loadThemeConfig();

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
    expect(serialize(themeConfig)).not.toMatch(/tester/i);
  });

  it('shows an interest-only, version-neutral call to action when opted in', async () => {
    const themeConfig = await loadThemeConfig('true');

    const announcement = themeConfig.announcementBar;
    expect(announcement).toBeDefined();
    const content = announcement?.content ?? '';
    expect(content).toMatch(/register interest/i);
    expect(content).toContain(TESTER_PAGE_PATH);

    // Interest-only: it must not claim testing is available now.
    expect(content).toMatch(/has not started/i);
    expect(content).not.toMatch(/\bjoin the external tester cohort\b/i);

    // Version-neutral: no release number anywhere in the call to action.
    expect(content).not.toMatch(/v?\d+\.\d+(\.\d+)?/);

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
      const themeConfig = await loadThemeConfig(value);
      expect(
        themeConfig.announcementBar,
        `TESTER_INTEREST_OPEN="${value}" must not open the gate`,
      ).toBeUndefined();
      expect(navbarLabels(themeConfig)).not.toContain('Test Ferrite');
    }
  });

  it('keeps the rest of the site unchanged by the gate', async () => {
    const closed = await loadThemeConfig();
    const open = await loadThemeConfig('true');

    const closedNavbar = navbarLabels(closed).filter(
      (label) => label !== 'Test Ferrite',
    );
    const openNavbar = navbarLabels(open).filter(
      (label) => label !== 'Test Ferrite',
    );
    expect(openNavbar).toEqual(closedNavbar);

    const closedFooter = footerItems(closed).map((item) => item.label);
    const openFooter = footerItems(open)
      .map((item) => item.label)
      .filter((label) => label !== 'Tester Interest & Questions');
    expect(openFooter).toEqual(closedFooter);
  });
});

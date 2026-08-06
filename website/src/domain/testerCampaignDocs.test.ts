import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

const websiteRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const publicPage = readFileSync(
  resolve(websiteRoot, 'docs/community/tester-program.md'),
  'utf8',
);
const recruitment = readFileSync(
  resolve(websiteRoot, '../TESTER_RECRUITMENT.md'),
  'utf8',
);
const testerAssets = `${publicPage}\n${recruitment}`;

describe('tester campaign documentation', () => {
  it('keeps hands-on testing behind both immutable campaign references', () => {
    expect(testerAssets).toContain('CAMPAIGN_OPS_REF');
    expect(testerAssets).toContain('FERRITE_TEST_IMAGE');
    expect(testerAssets).toContain('<CAMPAIGN_IMAGE_DIGEST>');
    expect(publicPage).toContain('git checkout <CAMPAIGN_OPS_REF>');
    expect(publicPage).toContain('test -x scripts/tester.sh');
  });

  it('keeps the required path separate from owner-enabled durability', () => {
    for (const command of ['start', 'smoke', 'diagnostics', 'stop']) {
      expect(publicPage).toContain(`./scripts/tester.sh ${command}`);
    }
    expect(testerAssets).toContain('FERRITE_TEST_ENABLE_DURABILITY=1');
    expect(testerAssets).toMatch(/not part of the required\s+core path/);
  });

  it('uses the temporary issue intake and canonical security channel', () => {
    expect(testerAssets).toContain('template=tester_interest.yml');
    expect(testerAssets).toContain('SECURITY.md#reporting-a-vulnerability');
    expect(testerAssets).toContain('security@ferritelabs.dev');
  });

  it('does not advertise unavailable or disabled campaign channels', () => {
    expect(testerAssets).not.toMatch(/\bv0\.4\.0\b/i);
    expect(testerAssets).not.toMatch(/\bpre-release\b/i);
    expect(testerAssets).not.toContain('/discussions');
    expect(testerAssets).not.toContain('/security/advisories/new');
    expect(testerAssets).not.toMatch(/github\.com\/FerriteLabs/);
    expect(testerAssets).not.toMatch(/ghcr\.io\/ferritelabs\/ferrite:latest/);
  });

  it('preserves the ordered launch checklist and cohort size', () => {
    const orderedSteps = [
      '**Core intake:**',
      '**Ops tooling:**',
      '**Candidate image:**',
      '**Clean-machine preflight:**',
      '**Docs and outreach:**',
    ];
    let previous = -1;
    for (const step of orderedSteps) {
      const current = recruitment.indexOf(step);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
    expect(recruitment).toContain('8–12 testers');
  });
});

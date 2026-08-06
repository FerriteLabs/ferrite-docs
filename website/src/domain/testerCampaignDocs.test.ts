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
    expect(testerAssets).toMatch(/Registration is open for interest only/i);
    expect(testerAssets).toContain('CAMPAIGN_OPS_COMMIT');
    expect(testerAssets).toContain('FERRITE_TEST_IMAGE');
    expect(testerAssets).toContain('<CAMPAIGN_DIGEST>');
    expect(publicPage).toContain('test -x scripts/tester.sh');
  });

  it('pins ops provenance to an exact commit, never a tag or a branch', () => {
    // A tag can be moved after the campaign owner verifies it, so the
    // retired CAMPAIGN_OPS_REF spelling (which accepted "a tag or a commit")
    // must not come back anywhere in the tester assets.
    expect(testerAssets).not.toContain('CAMPAIGN_OPS_REF');
    expect(testerAssets).not.toMatch(/tags?\s+or\s+(?:an?\s+)?(?:full\s+)?commit/i);
    expect(publicPage).toContain('git checkout --detach <CAMPAIGN_OPS_COMMIT>');
    expect(publicPage).toContain(
      'test "$(git rev-parse HEAD)" = "<CAMPAIGN_OPS_COMMIT>"',
    );
    expect(testerAssets).toMatch(/40-character lowercase/);
    // No real 40-hex SHA may be published before a campaign exists.
    expect(testerAssets).not.toMatch(/(?<![0-9a-f])[0-9a-f]{40}(?![0-9a-f])/);
  });

  it('accepts only the complete repository-qualified digest reference, never a tag', () => {
    expect(publicPage).toContain(
      "export FERRITE_TEST_IMAGE='ghcr.io/ferritelabs/ferrite@sha256:<CAMPAIGN_DIGEST>'",
    );
    expect(testerAssets).not.toMatch(/governed non-floating tag/i);
    expect(testerAssets).not.toMatch(/or a tag; never `latest`/i);
  });

  it('keeps the required path separate from owner-enabled durability', () => {
    for (const command of ['start', 'smoke', 'diagnostics', 'stop']) {
      expect(publicPage).toContain(`./scripts/tester.sh ${command}`);
    }
    expect(testerAssets).toContain('FERRITE_TEST_ENABLE_DURABILITY=1');
    expect(testerAssets).toMatch(/not part of the required\s+core path/);
  });

  it('does not link the unpublished core tester intake before it exists', () => {
    // The canonical Tester Program and the Tester Interest/Report issue
    // forms have not merged yet; linking directly to them (or to a
    // template= issue URL that depends on them) would 404. The public page
    // must reference TESTER_PROGRAM.md by name/path only, and route
    // interest/report submission through the generic issue chooser instead
    // of a specific, not-yet-existing template query string.
    expect(publicPage).not.toContain('/blob/main/TESTER_PROGRAM.md');
    expect(publicPage).not.toContain('template=tester_interest.yml');
    expect(publicPage).not.toContain('template=tester_report.yml');
    expect(publicPage).toContain('https://github.com/ferritelabs/ferrite');
    expect(publicPage).toContain('/issues/new/choose');
    expect(publicPage).toMatch(/External tester interest/);
    expect(publicPage).toMatch(/External tester report/);

    // The canonical program is named as a repository path, and the campaign
    // invitation — not this page — supplies its published URL.
    expect(publicPage).toMatch(
      /`TESTER_PROGRAM\.md` at the root of\s+the \[ferrite repository\]/,
    );
    expect(publicPage).toMatch(/campaign invitation you receive supplies/i);

    // The recruitment playbook uses named placeholders instead of direct
    // links for the same not-yet-published assets.
    expect(recruitment).toContain('<PUBLISHED_TESTER_PROGRAM_URL>');
    expect(recruitment).toContain('<PUBLISHED_TESTER_INTEREST_URL>');
    expect(recruitment).not.toContain('/blob/main/TESTER_PROGRAM.md');
    expect(recruitment).not.toContain('template=tester_interest.yml');
  });

  it('uses the canonical GitHub private vulnerability reporting channel directly', () => {
    // Unlike the core tester intake, private vulnerability reporting is
    // already enabled and verified, so it is always linked directly rather
    // than through a placeholder.
    expect(testerAssets).toContain('SECURITY.md#reporting-a-vulnerability');
    expect(testerAssets).toContain('https://github.com/ferritelabs/ferrite/security/advisories/new');
  });

  it('does not advertise unavailable, disabled, or retired campaign channels', () => {
    expect(testerAssets).not.toMatch(/\bv0\.4\.0\b/i);
    expect(testerAssets).not.toMatch(/\bpre-release\b/i);
    expect(testerAssets).not.toContain('/discussions');
    expect(testerAssets).not.toMatch(/security@ferritelabs\.dev/i);
    expect(testerAssets).not.toMatch(/\bPGP\b/i);
    expect(testerAssets).not.toMatch(/not currently enabled/i);
    expect(testerAssets).not.toMatch(/github\.com\/FerriteLabs/);
    expect(testerAssets).not.toMatch(/ghcr\.io\/ferritelabs\/ferrite:latest/);
  });

  it('keeps the initial cohort Docker-only and is explicitly interest-only and version-neutral', () => {
    expect(testerAssets).toMatch(/Docker\/Docker Compose.only/i);
    expect(publicPage).toMatch(/including IDE\s+tooling, connects to the same running Docker Compose instance/);
    expect(recruitment).toMatch(/\[x\] \*\*Private security intake:\*\*/);
    expect(publicPage).toMatch(/Register interest for the next validation cohort/i);
    expect(publicPage).toMatch(/hands-on testing\s+opens only after/i);
  });

  it('preserves the ordered launch checklist and cohort phases', () => {
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
    const beforeOutreach = recruitment.indexOf('### Before outreach');
    const duringRecruitment = recruitment.indexOf('### During recruitment');
    const duringCampaign = recruitment.indexOf('### During campaign');
    const cohortCloseout = recruitment.indexOf('### Cohort closeout');
    expect(beforeOutreach).toBeGreaterThan(-1);
    expect(duringRecruitment).toBeGreaterThan(beforeOutreach);
    expect(duringCampaign).toBeGreaterThan(duringRecruitment);
    expect(cohortCloseout).toBeGreaterThan(duringCampaign);

    const preOutreachTasks = recruitment.slice(beforeOutreach, duringRecruitment);
    expect(preOutreachTasks).not.toMatch(/Monitor completion|Close the cohort|Select \*\*8–12/);

    const recruitmentTasks = recruitment.slice(duringRecruitment, duringCampaign);
    expect(recruitmentTasks).toMatch(/Select \*\*8–12 testers\*\*/);
    expect(recruitmentTasks).toMatch(/digest-bearing/i);

    expect(recruitment).toContain('8–12 testers');
  });

  it('gates public tester recruitment behind TESTER_INTEREST_OPEN', () => {
    expect(recruitment).toContain('TESTER_INTEREST_OPEN=true');

    // The gate may only be opened after the core intake and ops tooling are
    // merged (checklist steps 1 and 2) and the clean-machine preflight
    // (step 4) passes, so the ordering must be stated explicitly.
    const gateStep = recruitment.slice(recruitment.indexOf('**Publication gate:**'));
    expect(gateStep).toMatch(/only after/i);
    expect(gateStep).toMatch(/core intake/i);
    expect(gateStep).toMatch(/ops tooling/i);
    expect(gateStep).toMatch(/clean-machine\s+preflight/i);
    expect(gateStep).toMatch(/interest-only and version-neutral/i);

    // The publication gate step must come after the steps it depends on.
    expect(recruitment.indexOf('**Publication gate:**')).toBeGreaterThan(
      recruitment.indexOf('**Clean-machine preflight:**'),
    );
  });
});

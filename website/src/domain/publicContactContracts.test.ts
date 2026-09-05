import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

const websiteRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const repositoryRoot = resolve(websiteRoot, '..');
const publicContactFiles = [
  resolve(repositoryRoot, 'README.md'),
  resolve(repositoryRoot, 'SUPPORT.md'),
  resolve(websiteRoot, 'docs/community/support.md'),
  resolve(websiteRoot, 'docs/community/faq.md'),
  resolve(websiteRoot, 'docs/community/governance.md'),
  resolve(websiteRoot, 'docs/careers/senior-rust-engineer.md'),
  resolve(websiteRoot, 'docs/careers/distributed-systems-specialist.md'),
  resolve(websiteRoot, 'docs/getting-started/migration-from-redis.md'),
  resolve(websiteRoot, 'blog/2026-03-12-tiered-storage-deep-dive.md'),
  resolve(websiteRoot, 'blog/2026-02-20-why-ferrite-redis-alternative.md'),
  resolve(websiteRoot, 'docusaurus.config.ts'),
  resolve(websiteRoot, 'versioned_docs/version-0.2/community/support.md'),
  resolve(websiteRoot, 'versioned_docs/version-0.2/community/faq.md'),
  resolve(websiteRoot, 'versioned_docs/version-0.2/community/governance.md'),
  resolve(websiteRoot, 'versioned_docs/version-0.2/getting-started/migration-from-redis.md'),
];

describe('public contact contracts', () => {
  it('does not publish unavailable or parked web domains', () => {
    for (const path of publicContactFiles) {
      expect(readFileSync(path, 'utf8'), path).not.toMatch(
        /https?:\/\/(?:www\.)?ferrite\.(?:dev|rs)/i,
      );
    }
  });

  it('does not publish unverified Ferrite email domains', () => {
    for (const path of publicContactFiles) {
      expect(readFileSync(path, 'utf8'), path).not.toMatch(
        /[A-Za-z0-9._%+-]+@(?:ferrite|ferritelabs)\.(?:dev|rs)/i,
      );
    }
  });

  it('warns that repository support discussions are public', () => {
    const support = readFileSync(resolve(repositoryRoot, 'SUPPORT.md'), 'utf8');
    expect(support).toContain('GitHub Discussions may be used only to request maintainer coordination');
    expect(support).toContain('do not include confidential business');
  });
});

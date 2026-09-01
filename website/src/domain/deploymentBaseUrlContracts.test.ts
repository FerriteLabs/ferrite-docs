import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

const websiteRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const read = (path: string): string =>
  readFileSync(resolve(websiteRoot, path), 'utf8');

describe('GitHub Pages deployment contracts', () => {
  it('makes raw configuration URLs base-aware', () => {
    const config = read('docusaurus.config.ts');

    expect(config).toContain("const siteBaseUrl = (() =>");
    expect(config).toContain('withBaseUrl(testerProgramPath)');
    expect(config).toContain("href: withBaseUrl('/manifest.json')");
    expect(config).toContain("label: 'v0.5'");
  });

  it('uses Docusaurus Link for internal React navigation', () => {
    const aiPage = read('src/pages/ai.tsx');
    const playground = read('src/components/Playground/index.tsx');

    expect(aiPage).toContain('<Link');
    expect(aiPage).not.toContain('href="/docs/');
    expect(playground).toContain('<Link');
    expect(playground).not.toContain('href="/docs/');
  });

  it('keeps manifest navigation relative to the deployed base path', () => {
    const manifest = JSON.parse(read('static/manifest.json')) as {
      start_url: string;
      icons: Array<{src: string}>;
    };

    expect(manifest.start_url).toBe('./');
    expect(manifest.icons.map((icon) => icon.src)).toContain('img/logo.svg');
  });

  it('does not advertise an unsupported full-server WASM artifact', () => {
    for (const path of [
      'docs/deployment/edge-wasm.md',
      'versioned_docs/version-0.2/deployment/edge-wasm.md',
    ]) {
      const content = read(path);
      expect(content).toContain('no supported full-server WASM build command');
      expect(content).toContain('expected to fail');
      expect(content).toContain('Non-Runnable Platform Design Sketches');
      expect(content).toContain('Design sketches only');
      expect(content).not.toMatch(/wasm32-wasi(?!p)/);
    }

    for (const path of [
      'docs/extensibility/plugin-system.md',
      'versioned_docs/version-0.2/extensibility/plugin-system.md',
    ]) {
      const content = read(path);
      expect(content).toContain('wasm32-wasip1');
      expect(content).not.toMatch(/wasm32-wasi(?!p)/);
    }
  });
});

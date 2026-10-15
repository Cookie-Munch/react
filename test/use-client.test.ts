/**
 * N-02 (Numestri re-check): `@cookiemunch/react@0.1.0` shipped no "use client" directive, so a
 * Next.js App Router Server Component (app/layout.tsx) could not import `ConsentProvider`. The
 * first fix marked the WHOLE package "use client" — which broke the other half: `isGranted` and
 * the cookie helpers became client references, uncallable from a Server Component reading
 * `cookies()` in layout.tsx.
 *
 * So the build is split into three modules:
 *   - client.js  — "use client": the provider, the hooks, the gate.
 *   - helpers.js — no directive: isGranted, consentCookie, the cookie parser, the types.
 *   - index.js   — no directive, nothing but re-exports of the two. On the React Server layer
 *                  Next turns the client.js re-exports into client references and leaves the
 *                  helpers as plain functions, so `import { ConsentProvider, isGranted }` from
 *                  the root works in a Server Component.
 *
 * Tests run against source, but a directive lives or dies in the bundle (esbuild drops one
 * written in a source file), so this builds the package with its own tsup config into a temp
 * directory and reads what would be published. The full `next build` of an App Router fixture
 * is scripts/check-react-app-router.sh; here, Next's own SWC transform stands in for it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build, type Options } from 'tsup';
import config from '../tsup.config.js';

const pkg = resolve(__dirname, '..');
// The dashboard app, for Next's own transform. Absent in the public mirror; those tests skip.
const web = resolve(pkg, '..', '..', 'apps', 'web');
let out: string;

const CLIENT = ['ConsentGate', 'ConsentProvider', 'useConsent', 'useConsentCookie', 'useConsentValue'];
const HELPERS = ['CONSENT_COOKIE_NAME', 'consentCookie', 'isGranted', 'parseConsentCookie'];

beforeAll(async () => {
  out = mkdtempSync(join(tmpdir(), 'cm-react-dist-'));
  const configs = (Array.isArray(config) ? config : [config]) as Options[];
  for (const c of configs) {
    const entry = Object.fromEntries(Object.entries(c.entry as Record<string, string>).map(([k, v]) => [k, join(pkg, v)]));
    await build({ ...c, entry, outDir: out, sourcemap: false, silent: true, clean: false, config: false });
  }
}, 60_000);

afterAll(() => {
  if (out) rmSync(out, { recursive: true, force: true });
});

const read = (file: string) => readFileSync(join(out, file), 'utf8');
const firstLine = (file: string) => read(file).split('\n')[0];
const names = (list: string) => list.split(',').map((s) => s.trim()).filter(Boolean).sort();
/** The names a module takes from `from` (`import { … } from` or `export { … } from`), sorted. */
function reExports(code: string, from: string): string[] {
  const m = new RegExp(`(?:import|export)\\s*\\{([^}]*)\\}\\s*from\\s*["']${from.replace(/\./g, '\\.')}["']`).exec(code);
  return m ? names(m[1]!) : [];
}
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

describe('the published build', () => {
  it('emits exactly the three modules', () => {
    expect(readdirSync(out).filter((f) => f.endsWith('.js')).sort()).toEqual(['client.js', 'helpers.js', 'index.js']);
  });

  it('client.js starts with "use client"', () => {
    expect(firstLine('client.js')).toBe('"use client";');
  });

  it('client.js takes the helpers from helpers.js rather than carrying a second copy', () => {
    expect(read('client.js')).toMatch(/from\s*["']\.\/helpers\.js["']/);
    expect(read('client.js')).not.toMatch(/function isGranted/);
  });

  it('helpers.js has no directive and nothing from React', () => {
    expect(read('helpers.js')).not.toContain('use client');
    expect(read('helpers.js')).not.toMatch(/from\s*["']react["']/);
    expect(read('helpers.js')).toMatch(/function isGranted/);
  });

  it('index.js has no directive and is nothing but re-exports of client.js and helpers.js', () => {
    const code = read('index.js');
    expect(code).not.toContain('use client');
    // esbuild writes a re-export as an import plus an export list. Nothing else may be there:
    // one import from each sibling, and one export list naming exactly what they bring in.
    const statements = stripComments(code).split(';').map((s) => s.trim()).filter(Boolean);
    expect(statements).toHaveLength(3);
    expect(statements[0]).toMatch(/^import\s*\{[^}]*\}\s*from\s*["']\.\/client\.js["']$/);
    expect(statements[1]).toMatch(/^import\s*\{[^}]*\}\s*from\s*["']\.\/helpers\.js["']$/);
    expect(statements[2]).toMatch(/^export\s*\{[^}]*\}$/);
    expect(reExports(code, './client.js')).toEqual(CLIENT);
    expect(reExports(code, './helpers.js')).toEqual(HELPERS);
    expect(names(/^export\s*\{([^}]*)\}$/.exec(statements[2]!)![1]!)).toEqual([...CLIENT, ...HELPERS].sort());
  });

  it('the source root has the same shape: re-exports of ./client.js and ./helpers.js only', () => {
    const src = stripComments(readFileSync(join(pkg, 'src/index.ts'), 'utf8'));
    const froms = [...src.matchAll(/from\s*["']([^"']+)["']/g)].map((m) => m[1]);
    expect(froms).toEqual(['./client.js', './helpers.js']);
    expect(src).not.toMatch(/^\s*import\s/m);
    expect(src).not.toContain('use client');
  });

  it('the types follow the same split: one declaration of Window.CookieMunch, in helpers.d.ts', () => {
    // A second copy of types.ts in client.d.ts would declare the global twice — TS2717 for anyone
    // without skipLibCheck.
    expect(readdirSync(out).filter((f) => f.endsWith('.d.ts')).sort()).toEqual(['client.d.ts', 'helpers.d.ts', 'index.d.ts']);
    expect(read('client.d.ts')).not.toContain('declare global');
    expect(read('index.d.ts')).not.toContain('declare global');
    expect(read('helpers.d.ts')).toContain('declare global');
    expect(read('helpers.d.ts')).not.toMatch(/from\s*["']\.\/client\.js["']|import\s*["']\.\/client\.js["']/);
    expect(read('client.d.ts')).toMatch(/from\s*["']\.\/helpers\.js["']/);
  });

  it('is a version that carries the split (0.1.1 or later)', () => {
    const manifest = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')) as { version: string };
    const [major, minor, patch] = manifest.version.split('.').map(Number) as [number, number, number];
    expect(major * 1e6 + minor * 1e3 + patch).toBeGreaterThanOrEqual(1001);
  });
});

/** Next's SWC transform, as it runs on the React Server layer. Absent if apps/web is not installed. */
async function serverLayer(file: string, code: string): Promise<string> {
  const req = createRequire(join(web, 'package.json'));
  const { transform } = req('next/dist/build/swc') as { transform: (src: string, opts: object) => Promise<{ code: string }> };
  const { getLoaderSWCOptions } = req('next/dist/build/swc/options') as { getLoaderSWCOptions: (o: object) => object };
  const opts = getLoaderSWCOptions({
    filename: file, development: false, isServer: true, appDir: join(web, 'app'), pagesDir: undefined,
    isPageFile: false, hasReactRefresh: false, serverComponents: true, bundleLayer: 'rsc', esm: true,
    jsConfig: {}, supportedBrowsers: undefined, swcCacheDir: join(out, '.swc'), relativeFilePathFromRoot: file.slice(out.length + 1),
    serverReferenceHashSalt: '', cacheHandlers: {}, useCacheEnabled: false, isCacheComponents: false,
  });
  return (await transform(code, { ...opts, filename: file, sourceMaps: false })).code;
}

const CLIENT_ENTRY = /__next_internal_client_entry_do_not_use__ ([^ ]*) /;
const hasNext = existsSync(join(web, 'node_modules/next/package.json'));

describe.skipIf(!hasNext)('importing it from a Server Component', () => {
  it('client.js becomes a client reference for the provider, the hooks and the gate', async () => {
    const file = join(out, 'client.js');
    const code = await serverLayer(file, read('client.js'));
    const label = CLIENT_ENTRY.exec(code);
    expect(label, code.slice(0, 300)).not.toBeNull();
    expect(label![1]!.split(',').sort()).toEqual(CLIENT);
    expect(code).toContain('createProxy');
    expect(code).not.toContain('useEffect'); // the hooks never run on the server
  });

  it('helpers.js stays server code: isGranted is a real function there, not a reference', async () => {
    const file = join(out, 'helpers.js');
    const code = await serverLayer(file, read('helpers.js'));
    expect(code).not.toMatch(CLIENT_ENTRY);
    expect(code).not.toContain('createProxy');
    expect(code).toMatch(/function isGranted/);
  });

  it('index.js stays server code and passes the client.js re-exports through to the proxy', async () => {
    const file = join(out, 'index.js');
    const code = await serverLayer(file, read('index.js'));
    expect(code).not.toMatch(CLIENT_ENTRY);
    expect(reExports(code, './client.js')).toEqual(CLIENT);
    expect(reExports(code, './helpers.js')).toEqual(HELPERS);
  });

  it('without the directive, Next refuses client.js on the server — the 0.1.0 bug', async () => {
    const file = join(out, 'client.js');
    const without = read('client.js').replace(/^"use client";\n/, '');
    await expect(serverLayer(file, without)).rejects.toThrow(/only works in a Client Component/);
  });
});

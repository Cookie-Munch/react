import { defineConfig, type Options } from 'tsup';

// Three modules, split for Next.js App Router (React Server Components):
//   client.js  — "use client": the provider, the hooks, the gate.
//   helpers.js — no directive: isGranted, consentCookie, parseConsentCookie, the types. A Server
//                Component can call these (e.g. on `cookies()` in app/layout.tsx).
//   index.js   — no directive, only re-exports of the two, so the root import works on both sides.
// A directive in the source would be dropped by the bundler, so client.js gets it as a banner,
// written verbatim as the first line. Siblings stay external — in the JS and in the .d.ts — so each
// module exists exactly once: the client modules import from './helpers.js' rather than carrying a
// copy (a second copy of types.ts would declare `Window.CookieMunch` twice, which TypeScript rejects).
const common: Options = {
  format: ['esm'],
  dts: true,
  sourcemap: true,
  splitting: false,
};

export default defineConfig([
  {
    ...common,
    entry: { client: 'src/client.ts' },
    banner: { js: '"use client";' },
    external: ['react', /^\.\/helpers\.js$/],
  },
  // Built on its own: sharing a build with index would give helpers.d.ts a stray `import './client.js'`.
  { ...common, entry: { helpers: 'src/helpers.ts' } },
  {
    ...common,
    entry: { index: 'src/index.ts' },
    external: [/^\.\/(client|helpers)\.js$/],
  },
]);

import { defineConfig } from 'vitest/config';

// DOM tests opt into happy-dom per-file via a `// @vitest-environment happy-dom`
// comment. Keep happy-dom from ever hitting the network: the wrapper injects the
// CDN embed <script>, and tests drive a fake `window.CookieMunch` instead — the
// real script must never load.
export default defineConfig({
  test: {
    environmentOptions: {
      happyDOM: {
        settings: {
          disableJavaScriptFileLoading: true,
          disableCSSFileLoading: true,
          disableIframePageLoading: true,
        },
      },
    },
  },
});

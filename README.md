# @cookiemunch/react

React / Next.js wrapper for **Cookie Munch**. A standalone, script-tag SDK: it loads the
Cookie Munch browser embed (`consent.js`) from the CDN at runtime and exposes reactive
consent state to your components. It does **not** bundle the proprietary engine and has
**no `@cookiemunch/*` dependency** — the wrapper only ever talks to the `window.CookieMunch`
global the embed installs.

- `<ConsentProvider>` — injects the embed and publishes consent state via React context. SSR-safe (no `window`/`document` access during render).
- `useConsent()` — read consent state and drive the CMP (`acceptAll`, `declineAll`, `submitCustomConsent`, `withdraw`, `show`, `renew`).
- `<ConsentGate>` — render children only when a given category is consented.

## Install

```bash
npm install @cookiemunch/react
```

`react` (>=18) is a peer dependency.

## Usage

```tsx
import { ConsentProvider, ConsentGate, useConsent } from '@cookiemunch/react';

export default function App({ children }) {
  return (
    <ConsentProvider cbid="YOUR_SITE_ID">
      {children}
      <ConsentGate category="statistics">
        <Analytics />
      </ConsentGate>
    </ConsentProvider>
  );
}

function ConsentButtons() {
  const { ready, consented, acceptAll, declineAll } = useConsent();
  if (!ready) return null;
  return (
    <div>
      <button onClick={acceptAll}>Accept all</button>
      <button onClick={declineAll}>Decline all</button>
    </div>
  );
}
```

By default the embed loads from `https://cdn.cookiemunch.net/consent.js`. Override with the
`src` prop, and override the API the embed beacons to with `apiBase`.

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
```

## License

MIT

# React SDK

Full documentation: https://cookiemunch.net/docs/sdk-react

`@cookiemunch/react` is a thin React/Next.js wrapper around the Cookie Munch browser embed (`consent.js`). It does not bundle the consent engine itself — at runtime it injects the same `<script data-cbid="...">` tag you'd otherwise hand-write, waits for the embed to assign `window.CookieMunch`, and exposes that object's state and actions through a context, a hook, and a gating component. Because the engine stays out of your bundle, this package has no dependency on `@cookiemunch/core` — it only depends on `react` (`>=18`) as a peer dependency, and ships pre-built (no separate build step in your app).

If you already have `consent.js` on the page some other way (Google Tag Manager, a `<script>` tag in your HTML template, a previous SSR render), `ConsentProvider` detects the existing `window.CookieMunch` and reuses it instead of injecting a second copy.

## Install

```bash
npm install @cookiemunch/react
# or
pnpm add @cookiemunch/react
# or
yarn add @cookiemunch/react
```

## Quick start

Wrap your app (or just the part of the tree that needs consent state) in `<ConsentProvider>`, giving it your site id (`cbid`):

```tsx
// app/layout.tsx (Next.js App Router) or your root component
import { ConsentProvider } from '@cookiemunch/react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ConsentProvider cbid="your-site-id">{children}</ConsentProvider>
      </body>
    </html>
  );
}
```

That's it — the banner itself is rendered by the embed script, not by React. The provider's job is purely to load `consent.js` and mirror its state into React so the rest of your component tree can read it and react to it.

### `ConsentProviderProps`

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `cbid` | `string` | yes | Your Cookie Munch site id. Injected as `data-cbid` on the embed `<script>` tag. |
| `src` | `string` | no | URL of the embed script. Defaults to `https://cdn.cookiemunch.net/consent.js` — override only to serve it from your own static origin. |
| `apiBase` | `string` | no | Overrides the API origin the embed beacons consent decisions to. Injected as `data-api`. Omit it to use the default (same origin as the CDN). |
| `children` | `ReactNode` | yes | Your app tree. |

`ConsentProvider` is SSR-safe: it never touches `window` or `document` during render, only inside an effect, so it's safe to mount in a Next.js Server Component boundary (the provider itself must be a Client Component, but its children don't have to be). Until the embed reports in, descendants see a not-ready, all-denied snapshot (`necessary: true`, everything else `false`) rather than throwing or blocking render.

If `cbid`, `src`, or `apiBase` change on a re-render, the provider re-binds to the (possibly new) embed instance.

## Reading consent with `useConsent()`

Call `useConsent()` from any descendant of `ConsentProvider`. It throws if called outside one, so you'll find out immediately if the provider is missing higher up the tree.

```tsx
import { useConsent } from '@cookiemunch/react';

function CookieSettingsLink() {
  const { show, ready } = useConsent();
  if (!ready) return null;
  return <button onClick={show}>Cookie settings</button>;
}
```

`useConsent()` returns a `ConsentContextValue`:

| Field | Type | Description |
| --- | --- | --- |
| `ready` | `boolean` | `true` once the embed has loaded and reported its first state. |
| `consent` | `PublicConsent` | The current per-category snapshot (see below). |
| `hasResponse` | `boolean` | `true` once the visitor has any recorded decision, explicit or implied. |
| `consented` | `boolean` | `true` once the visitor has an active, valid consent decision. |
| `acceptAll()` | `() => void` | Grants every category. |
| `declineAll()` | `() => void` | Denies every non-necessary category. |
| `submitCustomConsent(preferences, statistics, marketing)` | `(boolean, boolean, boolean) => void` | Records a specific per-category decision, bypassing the banner UI — e.g. for a custom preferences form you build in React. |
| `withdraw()` | `() => void` | Revokes all non-necessary consent and re-blocks previously activated scripts. |
| `show()` | `() => void` | Opens the phase-1 banner. |
| `renew()` | `() => void` | Re-prompts on the site's configured surface (banner, or straight to preferences if configured that way). |

`consent` is a `PublicConsent` object:

```ts
interface PublicConsent {
  necessary: boolean;
  preferences: boolean;
  statistics: boolean;
  marketing: boolean;
  personalizedAds: boolean; // granular IAB TCF signal, falls back to `marketing`
  basicAds: boolean;
  adProfiling: boolean;
  adMeasurement: boolean;
  stamp: string; // the consent-receipt id
  [key: string]: boolean | string; // custom categories, if your config defines any
}
```

Before the embed has reported in (`ready === false`), `consent` reads as `{ necessary: true, preferences: false, statistics: false, marketing: false, ... , stamp: '' }` — treat that as "no decision yet," not as an explicit decline.

Because `submitCustomConsent` bypasses the embed's own UI, you can also build a fully custom preferences screen in React — a form that toggles checkboxes and calls `submitCustomConsent(preferences, statistics, marketing)` on submit — and it still writes through the same engine, ledger, and receipt stamp as the stock banner.

## Gating components with `<ConsentGate>`

`<ConsentGate>` renders its children only when a given category is granted, and a `fallback` (default `null`) otherwise. It's a thin wrapper over `useConsent()` — use it when you want to keep a component tree declarative rather than branching on `consent[category]` yourself:

```tsx
import { ConsentGate } from '@cookiemunch/react';

function Page() {
  return (
    <ConsentGate category="marketing" fallback={<p>Enable marketing cookies to see this widget.</p>}>
      <RetargetingPixel />
    </ConsentGate>
  );
}
```

### `ConsentGateProps`

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `category` | `'preferences' \| 'statistics' \| 'marketing'` | yes | The category to gate on. `'necessary'` is intentionally excluded — it's always granted, so gating on it would be a no-op. |
| `children` | `ReactNode` | yes | Rendered when `category` is granted. |
| `fallback` | `ReactNode` | no | Rendered when it isn't. Defaults to `null`. |

`ConsentGate` re-renders automatically whenever consent changes, because it reads from the same context `ConsentProvider` updates. There's no polling or manual refresh needed.

## Reacting to consent changes

`useConsent()`'s returned values already update on every accept/decline, so the most common pattern is simply reading `consent` inside a component and letting React re-render it. To run an imperative side effect (e.g. lazily initializing a third-party SDK) when a category newly becomes granted, combine it with `useEffect`:

```tsx
import { useConsent } from '@cookiemunch/react';
import { useEffect } from 'react';

function AnalyticsBootstrap() {
  const { consent, ready } = useConsent();

  useEffect(() => {
    if (ready && consent.statistics) {
      initAnalytics();
    }
  }, [ready, consent.statistics]);

  return null;
}
```

This mirrors what `window.CookieMunch.onConsentChange()` does at the embed level (see the [JavaScript API](https://cookiemunch.net/docs/js-api) docs) — `ConsentProvider` already subscribes to that event and flows updates through React state, so you never call `onConsentChange` yourself from React code.

## One category: `useConsentValue(category)`

When a component cares about one category, read just that:

```tsx
import { useConsentValue } from '@cookiemunch/react';

function ChatWidget() {
  const allowed = useConsentValue('chat'); // a custom category id works the same way
  return allowed ? <LiveChat /> : <ChatPlaceholder />;
}
```

It returns `true` while `category` is granted and re-renders when that changes, whatever changed it — a click, a withdrawal from a footer link, a returning visitor's stored decision. `'necessary'` is always `true`; everything else is `false` until the embed has reported, and during server rendering, so gated content never appears ahead of consent. It works inside `<ConsentProvider>` and also without one, when `consent.js` is on the page some other way: it then follows the embed's [`CookieMunchOnChange`](https://cookiemunch.net/docs/js-api) event directly.

## Store this only with consent: `consentCookie` and `useConsentCookie`

A first-party cookie of your own — an A/B bucket, an affiliate reference, a chat session — is only lawful while the visitor consents to its category. `consentCookie` keeps one in step: written while the category is granted, removed the moment it is not.

```tsx
import { useConsentCookie, consentCookie } from '@cookiemunch/react';

// In a component: follows consent for as long as the component is mounted.
function Affiliate({ ref }: { ref: string }) {
  useConsentCookie('aff_ref', 'marketing', ref, { maxAgeDays: 30 });
  return null;
}

// Anywhere else (no React needed): returns a function that stops following.
const stop = consentCookie('ab_bucket', 'statistics', () => pickBucket(), { maxAgeDays: 90 });
```

`consentCookie(name, category, value, options?)`:

- writes `name=value` (URL-encoded) when `category` is granted, and deletes it — with the same path and domain, which a browser requires to match — when it is not: a "Deny all", a selection that unticks the category, or `CookieMunch.withdraw()`
- does nothing until the embed has reported a decision; if the embed is already loaded it applies the current decision at once, and a returning visitor's stored decision is applied when the embed starts
- takes `value` as a string or a function. A function is called only when the cookie is about to be written and is not already there, so an id is never generated without consent, and one stored on an earlier page is kept rather than regenerated
- works with custom categories

| Option | Meaning |
| --- | --- |
| `maxAgeDays` | Lifetime in days. Default: a session cookie. |
| `path` | Default `/`. |
| `domain` | Share across subdomains, e.g. `example.com`. Default: host-only. |
| `sameSite` | `Lax` (default), `Strict` or `None`. |
| `secure` | Default: on for an HTTPS page; always on with `sameSite: 'None'`. |

`useConsentCookie(name, category, value, options?)` is the same thing tied to a component's lifetime. Pass a stable `value` (or a function defined outside render), since a change re-creates the subscription. Unmounting stops following but leaves the cookie as it is.

`isGranted(consent, category)` is the predicate both use, exported for your own code: it reads a category from `CookieMunch.consent` or from an event's `ConsentState`, custom categories included.

To read the same decision on your server, see [the consent cookie](https://cookiemunch.net/docs/consent-cookie).

## Notes

- There is no `<ConsentBanner>` export in `@cookiemunch/react` — banner UI is rendered by the embed script itself (configured from your Cookie Munch dashboard), not by React. `ConsentProvider` only bridges its state into your component tree. If you want a fully custom banner, hide the stock one in your config and drive `submitCustomConsent`/`acceptAll`/`declineAll` from your own UI as shown above.
- Everything exported (`ConsentProvider`, `useConsent`, `ConsentGate`, `useConsentValue`, `useConsentCookie`, `consentCookie`, `isGranted`, and the `Category` / `PublicConsent` / `CookieMunchGlobal` types) is available from the package root: `import { ... } from '@cookiemunch/react'`.
- Types for `window.CookieMunch` are declared locally in this package (not imported from `@cookiemunch/core`), so installing `@cookiemunch/react` alone is enough to get full typing in a project that never installs the core engine directly.

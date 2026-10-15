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

`ConsentProvider` is SSR-safe: it never touches `window` or `document` during render, only inside an effect. Until the embed reports in, descendants see a not-ready, all-denied snapshot (`necessary: true`, everything else `false`) rather than throwing or blocking render.

### Next.js App Router

From 0.1.1 a Server Component can import from the package root directly. The `app/layout.tsx` above works as written: no wrapper file, and no `"use client"` in your layout. Your layout and the pages under it stay Server Components; only the provider and the hooks run in the browser.

The package is built as two modules behind the root:

| Module | Directive | Exports |
| --- | --- | --- |
| client | `"use client"` | `ConsentProvider`, `useConsent`, `useConsentValue`, `useConsentCookie`, `ConsentGate` |
| helpers | none | `isGranted`, `parseConsentCookie`, `CONSENT_COOKIE_NAME`, `consentCookie`, the types |

The root entry has no directive and only re-exports the two. In a Server Component, Next.js turns the client names into client references, and the helpers stay plain functions you can call there. So a single import serves both:

```tsx
// app/layout.tsx — a Server Component
import { cookies } from 'next/headers';
import { ConsentProvider, CONSENT_COOKIE_NAME, isGranted, parseConsentCookie } from '@cookiemunch/react';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const consent = parseConsentCookie((await cookies()).get(CONSENT_COOKIE_NAME)?.value);
  return (
    <html lang="en">
      <body>
        <ConsentProvider cbid="your-site-id">{children}</ConsentProvider>
        {isGranted(consent, 'statistics') && <script src="/analytics.js" async />}
      </body>
    </html>
  );
}
```

`parseConsentCookie(value)` reads the embed's `CookieMunch` cookie: the URL-encoded JSON the embed writes, plain JSON, or a legacy Cookiebot value. It returns the decision, or `null` when there is none the embed would honour. `isGranted(null, category)` is `true` only for `necessary`. It does not apply `minVersion` or `expiryDays`. For those, use `readConsent` from `@cookiemunch/sdk/consent` (see [the consent cookie](/docs/consent-cookie)).

Hooks and components still only work in Client Components. `consentCookie` can be imported anywhere, but it does nothing on the server, because there is no `document` there.

On 0.1.0, importing `ConsentProvider` in a Server Component failed `next build` with *"You're importing a component that needs `useEffect`"*. If you added a wrapper for that (a `providers.tsx` with `"use client"` that re-exports `ConsentProvider`), it still works, and you can delete it after upgrading.

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
- Everything exported (`ConsentProvider`, `useConsent`, `ConsentGate`, `useConsentValue`, `useConsentCookie`, `consentCookie`, `isGranted`, `parseConsentCookie`, `CONSENT_COOKIE_NAME`, and the `Category` / `PublicConsent` / `CookieMunchGlobal` / `ConsentCookieState` types) is available from the package root: `import { ... } from '@cookiemunch/react'`, in Client and Server Components alike.
- Types for `window.CookieMunch` are declared locally in this package (not imported from `@cookiemunch/core`), so installing `@cookiemunch/react` alone is enough to get full typing in a project that never installs the core engine directly.

# Changelog: @cookiemunch/react

Every published release, newest first. Dates are the day the version was cut.

## 0.6.0 (2026-11-05)

- `hasConsent(category)` and `onConsentChange(fn)`, moved here from `@cookiemunch/next`, which still exports them.

## 0.5.1 (2026-11-04)

- Changed: published from CI with an npm provenance attestation; no code change.

## 0.5.0 (2026-11-03)

- Added: `CookieMunchCategories`, an augmentable interface: `cookiemunch types` writes it so category arguments accept only your site's categories. Empty, any string still works.

## 0.4.0 (2026-11-02)

- Added: types for `CookieMunch.consentState(category)` and `CookieMunch.onConsent(category, cb)` on the embed global.
- Added: `CookieMunch.cbid`, the site the embed resolved (also with `data-cbid="auto"`).

## 0.3.0 (2026-10-24)

- Added: `<CookieSettingsLink>`, the "Cookie settings" link that reopens the visitor's choices. Plain markup the embed handles, so it renders the same on the server and needs no provider.
- Added: `useBannerInset()` — the bar's covered edge in pixels, live, for lifting floating buttons.

## 0.2.1 (2026-10-22)

- The package now ships this changelog and a README.

## 0.2.0 (2026-10-19)

- Added: `<CookieDeclaration>`, the live cookie declaration for a privacy page (the embed draws it; React does not own its children).
- Added: `<RightsLink>`, "your privacy rights" for a signed-in person: mints a single-use account link on click.

## 0.1.2 (2026-10-15)

- Changed: the package builds standalone from its public repository and is published with npm provenance.

## 0.1.1 (2026-10-15)

- Fixed: ships `"use client"` so App Router Server Components can import the package.
- Fixed: client and server-safe modules are split, so `isGranted` works in Server Components.

## 0.1.0 (2026-10-14)

- First release under `@cookiemunch/react`: `<ConsentProvider>`, `useConsent`, `<ConsentGate>`, plus `useConsentValue` and `consentCookie` / `useConsentCookie`.

# Changelog: @cookiemunch/react

Every published release, newest first. Dates are the day the version was cut.

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

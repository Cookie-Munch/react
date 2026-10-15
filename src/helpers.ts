// The server-safe half: no directive, nothing from React. Callable from a Server Component —
// read the consent cookie from `cookies()` and decide what to render before any client code runs.
export { consentCookie, isGranted, type ConsentCookieOptions } from './consent-cookie.js';
export { CONSENT_COOKIE_NAME, parseConsentCookie, type ConsentCookieState } from './consent-parse.js';
export type { Category, PublicConsent, CookieMunchGlobal } from './types.js';

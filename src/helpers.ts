// The server-safe half: no directive, nothing from React. Callable from a Server Component —
// read the consent cookie from `cookies()` and decide what to render before any client code runs.
export { consentCookie, isGranted, type ConsentCookieOptions } from './consent-cookie.js';
export { CONSENT_COOKIE_NAME, parseConsentCookie, type ConsentCookieState } from './consent-parse.js';
export type { Category, PublicConsent, CookieMunchGlobal } from './types.js';

/**
 * The URL shapes a minted link can have (docs: account-linked-rights): `https://<customDomain>/?t=…`
 * when the site has an active custom rights domain, else `https://<app>/r/<cbid>?t=…`. Anything
 * else — another scheme, no token — is refused rather than followed.
 */
export function isRightsLinkUrl(url: string, customDomain?: string | null): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || !u.searchParams.get('t')) return false;
  if (customDomain) return u.host === customDomain && u.pathname === '/';
  return /^\/r\/[^/]+$/.test(u.pathname);
}

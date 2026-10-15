/**
 * Read the embed's consent cookie on the server, where `document` does not exist — a Server
 * Component, a route handler, middleware:
 *
 *   const consent = parseConsentCookie((await cookies()).get(CONSENT_COOKIE_NAME)?.value);
 *   if (isGranted(consent, 'statistics')) { ... }
 *
 * The wire format is the embed's: URL-encoded JSON of its consent state. A legacy Cookiebot
 * `CookieConsent` value (a relaxed JS object literal) is read too. Standalone on purpose — this
 * package never imports `@cookiemunch/core`.
 */

/** The first-party cookie the embed stores the visitor's decision in. */
export const CONSENT_COOKIE_NAME = 'CookieMunch';

/** The category decisions a consent cookie carries. Pass it to `isGranted`. */
export interface ConsentCookieState {
  necessary: true;
  preferences: boolean;
  statistics: boolean;
  marketing: boolean;
  /** Custom categories the site defines, by id. */
  custom?: Record<string, boolean>;
  [key: string]: unknown;
}

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function json(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** `{stamp:'abc==',necessary:true,...}` → strict JSON: single quotes doubled, bare keys quoted. */
function legacy(text: string): unknown {
  if (!text.includes('necessary')) return undefined;
  return json(text.replace(/'/g, '"').replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":'));
}

/**
 * The decisions in a consent cookie value, or `null` when there is none the embed would honour
 * (not its format, or a required field missing or mistyped). `necessary` is always
 * true, whatever the cookie says. `null` passed to `isGranted` grants only `necessary`.
 */
export function parseConsentCookie(raw: string | null | undefined): ConsentCookieState | null {
  if (!raw) return null;
  const text = decode(raw);
  const o = json(text) ?? legacy(text);
  if (o === null || typeof o !== 'object' || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  const { preferences, statistics, marketing } = r;
  if (typeof preferences !== 'boolean' || typeof statistics !== 'boolean' || typeof marketing !== 'boolean') return null;
  // The rest of what the embed requires before it honours a value (see /docs/consent-cookie).
  if (r.method !== 'explicit' && r.method !== 'implied') return null;
  if (typeof r.ver !== 'number' || typeof r.utc !== 'number' || typeof r.region !== 'string') return null;
  if (typeof r.stamp !== 'string' && typeof r.stamp !== 'number') return null;
  const state: ConsentCookieState = { necessary: true, preferences, statistics, marketing };
  if (r.custom !== null && typeof r.custom === 'object' && !Array.isArray(r.custom)) {
    const custom: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(r.custom as Record<string, unknown>)) if (typeof v === 'boolean') custom[k] = v;
    if (Object.keys(custom).length > 0) state.custom = custom;
  }
  return state;
}

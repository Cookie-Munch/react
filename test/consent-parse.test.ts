/**
 * `parseConsentCookie` reads the embed's consent cookie on the server — a Server Component
 * holding `(await cookies()).get(CONSENT_COOKIE_NAME)?.value` — so it must run in plain Node
 * (this file has no DOM) and never trust what it cannot validate.
 */
import { describe, it, expect } from 'vitest';
import { CONSENT_COOKIE_NAME, isGranted, parseConsentCookie } from '../src/index.js';

const state = { necessary: true, preferences: false, statistics: true, marketing: false, method: 'explicit', stamp: 's1', ver: 1, utc: 1, region: 'gb' };
const wire = (o: unknown) => encodeURIComponent(JSON.stringify(o));

describe('parseConsentCookie', () => {
  it('names the cookie the embed writes', () => {
    expect(CONSENT_COOKIE_NAME).toBe('CookieMunch');
  });

  it('reads the URL-encoded JSON the embed writes, and isGranted reads the result', () => {
    const consent = parseConsentCookie(wire(state));
    expect(consent).toEqual({ necessary: true, preferences: false, statistics: true, marketing: false });
    expect(isGranted(consent, 'statistics')).toBe(true);
    expect(isGranted(consent, 'marketing')).toBe(false);
  });

  it('accepts a value a framework has already decoded', () => {
    expect(parseConsentCookie(JSON.stringify(state))?.statistics).toBe(true);
  });

  it('keeps custom categories where isGranted looks for them', () => {
    const consent = parseConsentCookie(wire({ ...state, custom: { chat: true, ab: false, junk: 'yes' } }));
    expect(consent?.custom).toEqual({ chat: true, ab: false });
    expect(isGranted(consent, 'chat')).toBe(true);
    expect(isGranted(consent, 'ab')).toBe(false);
  });

  it('never believes a cookie that says necessary is off', () => {
    expect(parseConsentCookie(wire({ ...state, necessary: false }))?.necessary).toBe(true);
  });

  it('reads a legacy Cookiebot CookieConsent value', () => {
    const legacy = "{stamp:'abc==',necessary:true,preferences:true,statistics:false,marketing:true,method:'explicit',ver:1,utc:1,region:'gb'}";
    expect(parseConsentCookie(encodeURIComponent(legacy))).toEqual({ necessary: true, preferences: true, statistics: false, marketing: true });
  });

  it('is not a decision when a field the embed requires is missing or mistyped — as /docs/consent-cookie says', () => {
    for (const field of ['preferences', 'statistics', 'marketing', 'method', 'ver', 'utc', 'stamp', 'region']) {
      const { [field]: _gone, ...rest } = state as Record<string, unknown>;
      expect(parseConsentCookie(wire(rest)), `without ${field}`).toBeNull();
    }
    expect(parseConsentCookie(wire({ ...state, method: 'guessed' }))).toBeNull();
    expect(parseConsentCookie(wire({ ...state, ver: '1' }))).toBeNull();
    expect(parseConsentCookie(wire({ ...state, stamp: 7 }))?.statistics).toBe(true); // a numeric stamp is fine
  });

  it('returns null for no cookie, garbage, or a value missing a category', () => {
    expect(parseConsentCookie(undefined)).toBeNull();
    expect(parseConsentCookie('')).toBeNull();
    expect(parseConsentCookie('%E0%A4%A')).toBeNull();
    expect(parseConsentCookie('not json')).toBeNull();
    expect(parseConsentCookie(wire({ ...state, marketing: 'yes' }))).toBeNull();
    expect(parseConsentCookie(wire([true]))).toBeNull();
    // and isGranted then denies everything but necessary
    expect(isGranted(parseConsentCookie(undefined), 'statistics')).toBe(false);
    expect(isGranted(parseConsentCookie(undefined), 'necessary')).toBe(true);
  });
});

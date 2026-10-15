import { useContext, useEffect, useSyncExternalStore } from 'react';
import { ConsentContext } from './context.js';
import { consentCookie, isGranted, type ConsentCookieOptions } from './helpers.js';

/** Window events after which the embed's consent may differ. */
const CHANGE_EVENTS = ['CookieMunchOnChange', 'CookieMunchOnAccept', 'CookieMunchOnDecline'];

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  for (const e of CHANGE_EVENTS) window.addEventListener(e, onStoreChange);
  return () => {
    for (const e of CHANGE_EVENTS) window.removeEventListener(e, onStoreChange);
  };
}

/**
 * Whether `category` is granted right now — `'preferences'`, `'statistics'`,
 * `'marketing'`, `'necessary'` (always true) or one of your custom category ids — and
 * re-renders when that changes, whatever changed it.
 *
 * `false` until the embed has reported (and during SSR), so gated content never renders
 * ahead of consent. Works inside `<ConsentProvider>` and, when the embed is on the page
 * some other way, without one.
 *
 *   const analytics = useConsentValue('statistics');
 */
export function useConsentValue(category: string): boolean {
  const ctx = useContext(ConsentContext);
  const standalone = useSyncExternalStore(
    subscribe,
    () => (typeof window === 'undefined' ? false : isGranted(window.CookieMunch?.consent, category)),
    () => false,
  );
  if (ctx) return ctx.ready ? isGranted(ctx.consent, category) : category === 'necessary';
  return standalone;
}

/**
 * {@link consentCookie} for a component's lifetime: the cookie is written while `category`
 * is granted and removed when it is not. Pass a stable `value` (or a lazy function); the
 * subscription is re-created when `name`, `category`, `value` or an option changes.
 *
 *   useConsentCookie('affiliate_id', 'marketing', ref, { maxAgeDays: 30 });
 */
export function useConsentCookie(
  name: string,
  category: string,
  value: string | (() => string),
  opts: ConsentCookieOptions = {},
): void {
  const { maxAgeDays, path, domain, sameSite, secure } = opts;
  useEffect(
    () => consentCookie(name, category, value, { maxAgeDays, path, domain, sameSite, secure }),
    [name, category, value, maxAgeDays, path, domain, sameSite, secure],
  );
}

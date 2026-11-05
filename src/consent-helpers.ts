// Consent outside React: gate code on it, or hear about it, without writing a wrapper round the window event.
import { isGranted } from './consent-cookie.js';

type Consent = Record<string, unknown> & { custom?: Record<string, boolean> };

/** The visitor's decision, once the embed has one. A later load announces itself through the change event. */
function decided(): Consent | null {
  const cm = window.CookieMunch;
  return cm?.hasResponse ? (cm.consent as unknown as Consent) : null;
}

/** Whether `category` is granted now. False on the server and before a decision; `necessary` is always true. */
export function hasConsent(category: string): boolean {
  if (category === 'necessary') return true;
  return typeof window !== 'undefined' && isGranted(decided() as never, category);
}

/**
 * Calls `fn` with the consent on every decision, and once straight away when the visitor has already decided.
 * Returns the unsubscribe. Does nothing on the server.
 */
export function onConsentChange(fn: (consent: Consent) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  let active = true;
  const onChange = (e: Event) => {
    const consent = (e as CustomEvent<{ consent?: Consent }>).detail?.consent;
    if (consent && active) fn(consent);
  };
  window.addEventListener('CookieMunchOnChange', onChange);
  const already = decided();
  if (already) queueMicrotask(() => { if (active) fn(already); });
  return () => {
    active = false;
    window.removeEventListener('CookieMunchOnChange', onChange);
  };
}

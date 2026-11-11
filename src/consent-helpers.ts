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

/** What `onConsentCategory` hands its callback. */
export interface ConsentTransition {
  /** The category's state now. */
  granted: boolean;
  /** Its state before this call: undefined on the first call (no decision seen yet in this page). */
  previous: boolean | undefined;
  /** True for the first call when the visitor had already decided before you subscribed: start what was granted, nothing changed. */
  replay: boolean;
  /** Why it changed, as the embed's change event says (`banner`, `api`, `withdraw`…); `replay` for a replay. */
  cause: string;
}

/**
 * Calls `fn` only when `category` actually changes: once straight away as a replay when the visitor
 * has already decided, then on each grant or withdrawal, never twice for the same state. Start a
 * vendor on `granted`, stop it when `!granted && previous`. Returns the unsubscribe; nothing on the server.
 */
export function onConsentCategory(category: string, fn: (t: ConsentTransition) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  let active = true;
  let last: boolean | undefined;
  const emit = (consent: Consent, cause: string, replay: boolean) => {
    const granted = category === 'necessary' || isGranted(consent as never, category);
    if (!active || granted === last) return;
    const previous = last;
    last = granted;
    fn({ granted, previous, replay, cause });
  };
  const onChange = (e: Event) => {
    const d = (e as CustomEvent<{ consent?: Consent; cause?: unknown }>).detail;
    if (d?.consent) emit(d.consent, typeof d.cause === 'string' ? d.cause : 'change', false);
  };
  window.addEventListener('CookieMunchOnChange', onChange);
  const already = decided();
  if (already) queueMicrotask(() => emit(already, 'replay', true));
  return () => {
    active = false;
    window.removeEventListener('CookieMunchOnChange', onChange);
  };
}

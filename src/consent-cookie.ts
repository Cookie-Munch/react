/**
 * "Store this only with consent" — the helper every integrator ends up writing.
 *
 * A first-party cookie of your own (an A/B bucket, an affiliate id, a chat session) is
 * only lawful while the visitor consents to the category it belongs to. `consentCookie`
 * writes it the moment that consent holds and removes it the moment it stops — a
 * withdrawal from a footer link, a "Deny all", a selection that unticks the category —
 * and does nothing at all until the embed has said what the visitor decided.
 *
 * Framework-free: it listens to the embed's `CookieMunchOnChange` window event, so it
 * works with or without `<ConsentProvider>`, and with custom categories.
 */

/** Anything carrying a category decision: the public `consent` snapshot or a `ConsentState`. */
type ConsentLike = Record<string, unknown> & { custom?: Record<string, unknown> };

/**
 * Whether `category` is granted in a consent snapshot. `necessary` is always granted. A
 * custom category is read from the top level (the public `CookieMunch.consent` snapshot)
 * or from `custom` (the `ConsentState` that events carry). Anything else: not granted.
 */
export function isGranted(consent: ConsentLike | null | undefined, category: string): boolean {
  if (category === 'necessary') return true;
  if (!consent) return false;
  const top = consent[category];
  if (typeof top === 'boolean') return top;
  return consent.custom?.[category] === true;
}

export interface ConsentCookieOptions {
  /** Lifetime in days. Default: a session cookie (no max-age). */
  maxAgeDays?: number;
  /** Default `/`. */
  path?: string;
  /** Domain attribute, e.g. `example.com` to share across subdomains. Default: host-only. */
  domain?: string;
  /** Default `Lax`. */
  sameSite?: 'Lax' | 'Strict' | 'None';
  /** Default: true on an https page. Forced on with `sameSite: 'None'`, as browsers require. */
  secure?: boolean;
}

/** The detail of `CookieMunchOnChange` — only the part this helper reads. */
interface ChangeDetail {
  consent?: ConsentLike;
}

function hasDom(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function attributes(opts: ConsentCookieOptions): string[] {
  const parts = [`path=${opts.path ?? '/'}`];
  if (opts.domain) parts.push(`domain=${opts.domain}`);
  const sameSite = opts.sameSite ?? 'Lax';
  parts.push(`SameSite=${sameSite}`);
  const secure = opts.secure ?? (sameSite === 'None' || window.location?.protocol === 'https:');
  if (secure || sameSite === 'None') parts.push('Secure');
  return parts;
}

function setCookie(name: string, value: string, opts: ConsentCookieOptions): void {
  const parts = [`${name}=${encodeURIComponent(value)}`, ...attributes(opts)];
  if (typeof opts.maxAgeDays === 'number' && opts.maxAgeDays > 0) {
    parts.push(`max-age=${Math.round(opts.maxAgeDays * 86400)}`);
  }
  document.cookie = parts.join('; ');
}

function hasCookie(name: string): boolean {
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${name}=`));
}

/** Delete with the same path and domain it was written with — a browser matches on all three. */
function removeCookie(name: string, opts: ConsentCookieOptions): void {
  document.cookie = [`${name}=`, ...attributes(opts), 'max-age=0', 'expires=Thu, 01 Jan 1970 00:00:00 GMT'].join('; ');
}

/**
 * Keep the cookie `name` in step with consent for `category`: written (with `value`) while
 * it is granted, removed when it is not. `value` may be a function, called only when the
 * cookie is about to be written and is not already there — so an id is never even
 * generated without consent, and a stored one survives page loads.
 *
 * Applies the current decision immediately when the embed has already loaded, then follows
 * every change. Until the embed reports a decision, nothing is written or removed. Returns
 * a function that stops following (the cookie is left as it is).
 *
 *   const stop = consentCookie('ab_bucket', 'statistics', () => pickBucket(), { maxAgeDays: 30 });
 */
export function consentCookie(
  name: string,
  category: string,
  value: string | (() => string),
  opts: ConsentCookieOptions = {},
): () => void {
  if (!hasDom()) return () => {};

  let written: boolean | null = null;
  const apply = (consent: ConsentLike | null | undefined) => {
    if (!consent) return;
    const granted = isGranted(consent, category);
    if (granted) {
      // Once per grant, not on every repeated announcement. A lazy value that is already
      // stored (from an earlier page) is kept: regenerating it would, say, move a visitor
      // to a new A/B bucket on every page load.
      if (written !== true) {
        if (typeof value !== 'function') setCookie(name, value, opts);
        else if (!hasCookie(name)) setCookie(name, value(), opts);
      }
    } else {
      removeCookie(name, opts);
    }
    written = granted;
  };

  const onChange = (e: Event) => apply((e as CustomEvent<ChangeDetail>).detail?.consent);
  window.addEventListener('CookieMunchOnChange', onChange);

  // Already loaded: apply what is in force now. (A later load announces itself, including
  // a returning visitor's stored decision, through the same event.)
  const api = (window as { CookieMunch?: { consent?: unknown } }).CookieMunch;
  if (api?.consent) apply(api.consent as ConsentLike);

  return () => window.removeEventListener('CookieMunchOnChange', onChange);
}

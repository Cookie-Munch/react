import { useEffect, useRef } from 'react';

/** The sync token identify() earns lasts a day (server IDENTITY_TOKEN_TTL_MS); re-link well before it lapses. */
const RELINK_MS = 12 * 60 * 60 * 1000;

export interface ConsentIdentityProps {
  /**
   * The signed-in person's id in your app (any stable string), or null/undefined when nobody is signed in.
   * A change re-links; null unlinks this browser.
   */
  subject: string | null | undefined;
  /**
   * Mints a fresh subject token for `aud: cookiemunch:<cbid>` — with Atlas,
   * `() => getToken({ for: 'cookiemunch', cbid })`. Called on sign-in and every 12 hours while mounted,
   * since a token is valid for 120 seconds only. Resolve null to skip a round.
   */
  getToken?: () => Promise<string | null | undefined> | string | null | undefined;
  /**
   * Instead of `getToken`: a same-origin route of yours that mints the token server-side and answers
   * `{ token }` to a GET, e.g. `/api/atlas/token/cookiemunch` (LinkHub CM-L14). Sent with the page's
   * cookies; a 401 is retried once, then that round is skipped.
   */
  tokenUrl?: string;
}

async function fromUrl(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (res.status === 401 && attempt === 0) continue;
    if (!res.ok) return null;
    const t = ((await res.json()) as { token?: unknown } | null)?.token;
    return typeof t === 'string' && t ? t : null;
  }
  return null;
}

type Queue = { q?: unknown[]; version?: unknown; identify?: (token: string) => unknown };

function identify(token: string): void {
  const w = window as unknown as { __consent?: Queue };
  const fd = (w.__consent = w.__consent || { q: [] });
  // Before the embed loads, the call waits in the queue and is replayed in order.
  if (fd.version && typeof fd.identify === 'function') void fd.identify(token);
  else fd.q?.push(['identify', token]);
}

function unlink(): void {
  (window as unknown as { CookieMunch?: { setSyncToken?: (t: string | null) => void } }).CookieMunch?.setSyncToken?.(null);
}

/**
 * Links the visitor's consent decision to the signed-in person, so it follows them to their other
 * devices (https://cookiemunch.net/docs/consent-api#linking-a-decision-to-a-signed-in-person).
 * Put it once in the root layout, inside whatever provides the session. Renders nothing.
 */
export function ConsentIdentity({ subject, getToken, tokenUrl }: ConsentIdentityProps): null {
  const mint = useRef<() => unknown>(() => null);
  mint.current = getToken ?? (tokenUrl ? () => fromUrl(tokenUrl) : () => null);
  const linked = useRef(false);
  useEffect(() => {
    // Unlink only on sign-out: an anonymous first render must not clear a sync token set another way.
    if (!subject) {
      if (linked.current) unlink();
      linked.current = false;
      return;
    }
    linked.current = true;
    let live = true;
    const link = async (): Promise<void> => {
      try {
        const token = await mint.current();
        if (live && typeof token === 'string' && token) identify(token);
      } catch {
        // A failed mint links nothing; the next round (or the next sign-in) tries again.
      }
    };
    void link();
    const timer = setInterval(() => void link(), RELINK_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [subject]);
  return null;
}

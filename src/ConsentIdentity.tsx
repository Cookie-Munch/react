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
  getToken: () => Promise<string | null | undefined> | string | null | undefined;
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
export function ConsentIdentity({ subject, getToken }: ConsentIdentityProps): null {
  const mint = useRef(getToken);
  mint.current = getToken;
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
        if (live && token) identify(token);
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

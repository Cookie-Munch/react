import { useCallback, useState, type MouseEvent, type ReactNode } from 'react';
import { isRightsLinkUrl } from './helpers.js';

/** What `mint` may resolve to: the mint response from `POST /v1/sites/{cbid}/rights-links`, or just its `url`. */
export type MintedRightsLink = string | { url: string; customDomain?: string | null };

export interface RightsLinkProps {
  /**
   * Mints a single-use account link for the signed-in person — a server action (or an endpoint
   * you call) that holds a `dsar:rights-links` key and calls `POST /v1/sites/{cbid}/rights-links`.
   * Never put the key in the browser. Called on click, not on render: links are single-use and
   * expire (15 minutes by default), so one minted per page view would mostly go to waste.
   */
  mint: () => Promise<MintedRightsLink>;
  /** Where the link goes before a mint, and when one fails: the plain hosted form (the email-code flow), e.g. `https://cookiemunch.net/r/<cbid>`. */
  fallbackHref?: string;
  children?: ReactNode;
  className?: string;
  /** Called when a mint fails or returns a URL that is not a rights link, before falling back. */
  onError?: (error: Error) => void;
}

/**
 * "Your privacy rights" for a signed-in person: on click it mints an account link (their email is
 * filled in and locked, the email-code step skipped) and opens it. Plain anchor markup, so it
 * renders the same on the server and the client.
 */
export function RightsLink({ mint, fallbackHref, children = 'Your privacy rights', className, onError }: RightsLinkProps) {
  const [busy, setBusy] = useState(false);
  const onClick = useCallback(
    async (e: MouseEvent<HTMLAnchorElement>) => {
      // A modified click (new tab, download) keeps the fallback: a minted link is for this tab.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      if (busy) return;
      setBusy(true);
      try {
        const got = await mint();
        const url = typeof got === 'string' ? got : got.url;
        const customDomain = typeof got === 'string' ? undefined : got.customDomain;
        if (!isRightsLinkUrl(url, customDomain)) throw new Error(`not a rights link: ${url}`);
        window.location.assign(url);
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
        if (fallbackHref) window.location.assign(fallbackHref);
      } finally {
        setBusy(false);
      }
    },
    [busy, mint, fallbackHref, onError],
  );
  return (
    <a href={fallbackHref ?? '#'} className={className} onClick={onClick} aria-busy={busy || undefined}>
      {children}
    </a>
  );
}

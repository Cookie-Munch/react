import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ConsentContext, EMPTY_CONSENT, type ConsentContextValue } from './context.js';
import type { CookieMunchGlobal, PublicConsent } from './types.js';

/** Default CDN location of the base browser embed. */
const DEFAULT_SRC = 'https://cdn.cookiemunch.net/consent.js';
/** The <script> id the embed's bootstrap reads via getElementById. */
const SCRIPT_ID = 'CookieMunch';

export interface ConsentProviderProps {
  /** The Cookie Munch site id (required). Injected as `data-cbid` on the embed. */
  cbid: string;
  /** Embed URL. Defaults to the public CDN. */
  src?: string;
  /** Override the API base the embed beacons to (injected as `data-api`). */
  apiBase?: string;
  children: ReactNode;
}

interface Snapshot {
  ready: boolean;
  consent: PublicConsent;
  hasResponse: boolean;
  consented: boolean;
}

const INITIAL_SNAPSHOT: Snapshot = {
  ready: false,
  consent: EMPTY_CONSENT,
  hasResponse: false,
  consented: false,
};

/**
 * Locate the embed's <script> tag, injecting it if it isn't already present.
 * The embed self-bootstraps from the tag's `data-*` attributes and, once ready,
 * assigns `window.CookieMunch`.
 */
function ensureEmbedScript(cbid: string, src: string, apiBase: string | undefined): void {
  const existing = document.getElementById(SCRIPT_ID);
  if (existing) return;
  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = src;
  script.setAttribute('data-cbid', cbid);
  if (apiBase) script.setAttribute('data-api', apiBase);
  (document.head || document.documentElement).appendChild(script);
}

/**
 * Loads the Cookie Munch browser embed from the CDN at runtime and exposes
 * reactive consent state to descendants — a standalone script-tag SDK wrapper
 * that does NOT bundle the proprietary engine.
 *
 * SSR-safe: no `window`/`document` access during render; the script is injected
 * and the global API resolved only inside an effect. Descendants see an
 * all-denied, not-ready snapshot until the embed reports in.
 */
export function ConsentProvider({ cbid, src = DEFAULT_SRC, apiBase, children }: ConsentProviderProps) {
  const apiRef = useRef<CookieMunchGlobal | null>(null);
  const [snap, setSnap] = useState<Snapshot>(INITIAL_SNAPSHOT);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    let disposed = false;
    let offConsentChange: (() => void) | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const sync = (api: CookieMunchGlobal) => {
      if (disposed) return;
      setSnap({
        ready: true,
        consent: api.consent,
        hasResponse: api.hasResponse,
        consented: api.consented,
      });
    };

    const bind = (api: CookieMunchGlobal) => {
      if (disposed) return;
      apiRef.current = api;
      sync(api);
      offConsentChange = api.onConsentChange(() => sync(api));
    };

    // If the embed is already on the page, reuse it immediately.
    if (window.CookieMunch) {
      bind(window.CookieMunch);
    } else {
      ensureEmbedScript(cbid, src, apiBase);
      // The embed sets window.CookieMunch asynchronously (after its remote-config
      // fetch), so poll until it appears, then bind once.
      pollTimer = setInterval(() => {
        if (window.CookieMunch) {
          if (pollTimer) clearInterval(pollTimer);
          pollTimer = null;
          bind(window.CookieMunch);
        }
      }, 50);
    }

    return () => {
      disposed = true;
      if (pollTimer) clearInterval(pollTimer);
      offConsentChange?.();
      apiRef.current = null;
    };
    // Re-bind if the site id / source changes.
  }, [cbid, src, apiBase]);

  const api = apiRef.current;
  const value: ConsentContextValue = {
    ready: snap.ready,
    consent: snap.consent,
    hasResponse: snap.hasResponse,
    consented: snap.consented,
    acceptAll: () => api?.submitCustomConsent(true, true, true),
    declineAll: () => api?.submitCustomConsent(false, false, false),
    submitCustomConsent: (p, s, m) => api?.submitCustomConsent(p, s, m),
    withdraw: () => api?.withdraw(),
    show: () => api?.show(),
    renew: () => api?.renew(),
  };

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

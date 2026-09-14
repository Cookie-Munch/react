/**
 * Local, standalone type definitions for the Cookie Munch browser embed's public
 * surface. These are copied from the public shapes exposed on the global
 * `window.CookieMunch` object so this package can be published WITHOUT depending
 * on (or bundling) the proprietary `@cookiemunch/core` engine.
 *
 * Keep these in sync with the embed's public API by shape only — never import
 * from `@cookiemunch/core`.
 */

/** The four base consent categories. */
export type Category = 'necessary' | 'preferences' | 'statistics' | 'marketing';

/**
 * The visitor's consent snapshot, mirroring what the embed exposes at
 * `window.CookieMunch.consent`. Includes the four base categories, the granular
 * advertising signals, and a receipt `stamp`. Custom category keys may also be
 * present, hence the index signature.
 */
export interface PublicConsent {
  necessary: boolean;
  preferences: boolean;
  statistics: boolean;
  marketing: boolean;
  /** Granular advertising signals (IAB TCF purposes), else fall back to `marketing`. */
  personalizedAds: boolean;
  basicAds: boolean;
  adProfiling: boolean;
  adMeasurement: boolean;
  /** The current consent-receipt stamp. */
  stamp: string;
  /** Custom category keys are included when the site defines them. */
  [key: string]: boolean | string;
}

/**
 * The minimal shape of the global `window.CookieMunch` API this wrapper relies
 * on. The real embed exposes a superset of this (Cookiebot-compatible facade);
 * we only type the members we call.
 */
export interface CookieMunchGlobal {
  readonly consent: PublicConsent;
  readonly consented: boolean;
  readonly hasResponse: boolean;
  show(): void;
  renew(): void;
  /** Open the preference center / second layer. */
  showSettings(): void;
  withdraw(): void;
  submitCustomConsent(preferences: boolean, statistics: boolean, marketing: boolean): void;
  /** Subscribe to consent changes (accept/decline). Returns an unsubscribe fn. */
  onConsentChange(callback: (state: unknown) => void): () => void;
}

/** Augment the browser `Window` with the embed's globals. */
declare global {
  interface Window {
    CookieMunch?: CookieMunchGlobal;
  }
}

// No directive here, only re-exports. On the React Server layer Next turns the client.js names
// into client references and leaves the helpers as plain functions, so one root import —
// `import { ConsentProvider, isGranted } from '@cookiemunch/react'` — works in a Server Component.
export {
  ConsentProvider,
  type ConsentProviderProps,
  useConsent,
  type ConsentContextValue,
  ConsentGate,
  type ConsentGateProps,
  useConsentValue,
  useConsentCookie,
  useBannerInset,
  RightsLink,
  type RightsLinkProps,
  type MintedRightsLink,
  CookieDeclaration,
  type CookieDeclarationProps,
  CookieSettingsLink,
  type CookieSettingsLinkProps,
} from './client.js';
export {
  consentCookie,
  isGranted,
  type ConsentCookieOptions,
  CONSENT_COOKIE_NAME,
  parseConsentCookie,
  isRightsLinkUrl,
  type ConsentCookieState,
  type Category,
  type PublicConsent,
  type CookieMunchGlobal,
} from './helpers.js';

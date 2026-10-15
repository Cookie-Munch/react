// The Client Component half of the package: the build writes "use client" as the first line of
// client.js (a directive here would be dropped by the bundler). Named exports only — Next does
// not allow `export *` in a client boundary.
export { ConsentProvider, type ConsentProviderProps } from './ConsentProvider.js';
export { useConsent, type ConsentContextValue } from './useConsent.js';
export { ConsentGate, type ConsentGateProps } from './ConsentGate.js';
export { useConsentValue, useConsentCookie } from './useConsentValue.js';

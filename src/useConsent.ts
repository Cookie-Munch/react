import { useContext } from 'react';
import { ConsentContext, type ConsentContextValue } from './context.js';

export type { ConsentContextValue };

/** Access reactive consent state + actions. Must be used within a ConsentProvider. */
export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error('useConsent must be used within a <ConsentProvider>.');
  }
  return ctx;
}

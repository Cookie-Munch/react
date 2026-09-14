import { createContext } from 'react';
import type { PublicConsent } from './types.js';

export interface ConsentContextValue {
  ready: boolean;
  consent: PublicConsent;
  hasResponse: boolean;
  consented: boolean;
  acceptAll(): void;
  declineAll(): void;
  submitCustomConsent(preferences: boolean, statistics: boolean, marketing: boolean): void;
  withdraw(): void;
  show(): void;
  renew(): void;
}

export const EMPTY_CONSENT: PublicConsent = {
  necessary: true,
  preferences: false,
  statistics: false,
  marketing: false,
  personalizedAds: false,
  basicAds: false,
  adProfiling: false,
  adMeasurement: false,
  stamp: '',
};

/** null sentinel => used to detect "called outside a ConsentProvider". */
export const ConsentContext = createContext<ConsentContextValue | null>(null);

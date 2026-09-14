import type { ReactNode } from 'react';
import type { Category } from './types.js';
import { useConsent } from './useConsent.js';

export interface ConsentGateProps {
  category: Exclude<Category, 'necessary'>;
  children: ReactNode;
  fallback?: ReactNode;
}

/** Renders children only when the given category is granted (else `fallback`). */
export function ConsentGate({ category, children, fallback = null }: ConsentGateProps) {
  const { consent } = useConsent();
  return <>{consent[category] ? children : fallback}</>;
}

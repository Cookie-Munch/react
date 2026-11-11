import { useEffect, useRef } from 'react';
import { onConsentCategory, type ConsentTransition } from './helpers.js';

/**
 * `onConsentCategory` as a hook: `fn` runs only when `category` changes (and once as a replay when the
 * visitor had already decided). The latest `fn` is always the one called; resubscribes only when the category changes.
 */
export function useConsentTransition(category: string, fn: (t: ConsentTransition) => void): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => onConsentCategory(category, (t) => ref.current(t)), [category]);
}

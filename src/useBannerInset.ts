import { useSyncExternalStore } from 'react';

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('fd:layout', onStoreChange);
  return () => window.removeEventListener('fd:layout', onStoreChange);
}

function read(edge: 'bottom' | 'top'): number {
  if (typeof document === 'undefined') return 0;
  const v = document.documentElement.style.getPropertyValue(`--cookiemunch-inset-${edge}`);
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * How many pixels of the viewport's bottom (or top) edge the consent bar covers right now — 0
 * when no bar shows — re-rendering on every change. For floating UI the CSS variable
 * `--cookiemunch-inset-bottom` (or the vendor-neutral `--fd-safe-bottom`) does the same job
 * without a render; use this when the offset is computed in JavaScript.
 *
 *   const inset = useBannerInset();
 *   <ChatButton style={{ bottom: 20 + inset }} />
 *
 * 0 during SSR. Works with or without `<ConsentProvider>`.
 */
export function useBannerInset(edge: 'bottom' | 'top' = 'bottom'): number {
  return useSyncExternalStore(subscribe, () => read(edge), () => 0);
}

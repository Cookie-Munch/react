import { useEffect, useRef } from 'react';

export interface CookieDeclarationProps {
  /** Shown when the site has no cookies to list yet (the mount's `data-empty`). */
  emptyText?: string;
  className?: string;
  id?: string;
}

/**
 * Stable across renders: React rewrites `innerHTML` only when the `__html` string changes,
 * so an empty string that never changes means React never touches what the embed drew.
 */
const EMPTY = { __html: '' };

/**
 * The live cookie declaration, for a privacy page in a React / Next.js app (CKM-S-10).
 *
 * Renders `<div data-cc="declaration">` and lets the embed draw the table into it. The
 * embed fills the element whenever it appears — on first load, after a client-side
 * navigation, or before hydration on a server-rendered page — so the element's children
 * belong to the embed, not to React:
 *   - `dangerouslySetInnerHTML` with a constant empty string tells React it does not own
 *     the children, so it neither hydrates nor replaces them;
 *   - `suppressHydrationWarning` covers the one difference React would otherwise report:
 *     the server sent an empty element and the embed may already have filled it.
 * After mount it asks the embed to draw this element, in case it was added after load.
 */
export function CookieDeclaration({ emptyText, className, id }: CookieDeclarationProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const api = typeof window !== 'undefined' ? window.CookieMunch : undefined;
    if (el && !el.hasChildNodes()) void api?.renderDeclaration?.(el)?.catch?.(() => {});
  }, []);
  return (
    <div
      ref={ref}
      id={id}
      className={className}
      data-cc="declaration"
      {...(emptyText !== undefined ? { 'data-empty': emptyText } : {})}
      suppressHydrationWarning
      dangerouslySetInnerHTML={EMPTY}
    />
  );
}

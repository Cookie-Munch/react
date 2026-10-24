import type { ReactNode } from 'react';

export interface CookieSettingsLinkProps {
  children?: ReactNode;
  className?: string;
  /** Where the link points before the embed has loaded (or with scripts off). Default `#cookie-settings`. */
  href?: string;
}

/**
 * "Cookie settings": reopens the visitor's consent choices. It is plain markup — an anchor with
 * `data-cc="show-settings"`, which the embed's own click listener turns into
 * `CookieMunch.showSettings()` — so it renders identically on the server and the client, needs no
 * `<ConsentProvider>`, and opens the panel exactly once (no second handler of its own).
 */
export function CookieSettingsLink({ children = 'Cookie settings', className, href = '#cookie-settings' }: CookieSettingsLinkProps) {
  return (
    <a href={href} className={className} data-cc="show-settings">
      {children}
    </a>
  );
}

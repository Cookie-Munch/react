// @vitest-environment happy-dom
/**
 * CMU-X45: <CookieSettingsLink> — the "Cookie settings" link a footer or a UI kit renders. It is
 * plain markup the embed already listens for (`data-cc="show-settings"`), so it renders the same
 * on the server and the client and needs no hook, no effect and no provider.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { render, screen, cleanup } from '@testing-library/react';
import { CookieSettingsLink } from '../src/index.js';

afterEach(() => cleanup());

describe('CMU-X45: <CookieSettingsLink>', () => {
  it('renders server-side to the declarative trigger the embed handles', () => {
    const html = renderToString(<CookieSettingsLink className="foot" />);
    expect(html).toContain('data-cc="show-settings"');
    expect(html).toContain('class="foot"');
    expect(html).toContain('href="#cookie-settings"');
    expect(html).toContain('Cookie settings');
  });

  it('takes its own label and href, and works without a ConsentProvider', () => {
    render(<CookieSettingsLink href="/privacy#cookies">Réglages</CookieSettingsLink>);
    const a = screen.getByText('Réglages');
    expect(a.tagName).toBe('A');
    expect(a.getAttribute('href')).toBe('/privacy#cookies');
    expect(a.getAttribute('data-cc')).toBe('show-settings');
  });

  it('adds no click handler of its own, so the embed opens the settings exactly once', () => {
    const showSettings = vi.fn();
    (window as unknown as { CookieMunch: unknown }).CookieMunch = { showSettings };
    render(<CookieSettingsLink>Settings</CookieSettingsLink>);
    screen.getByText('Settings').click();
    // The embed's document-level listener (not present in this test) is what opens the panel.
    expect(showSettings).not.toHaveBeenCalled();
    delete (window as unknown as { CookieMunch?: unknown }).CookieMunch;
  });
});

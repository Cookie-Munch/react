// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { RightsLink, isRightsLinkUrl } from '../src/index.js';

describe('CKM-S-23: isRightsLinkUrl — the documented shapes and nothing else', () => {
  it('accepts cookiemunch.net/r/<cbid>?t=… and https://<customDomain>/?t=…', () => {
    expect(isRightsLinkUrl('https://cookiemunch.net/r/dv-abc?t=x.y')).toBe(true);
    expect(isRightsLinkUrl('https://privacy.acme.com/?t=x.y', 'privacy.acme.com')).toBe(true);
  });
  it('refuses another scheme, a missing token, the wrong host or path', () => {
    expect(isRightsLinkUrl('http://cookiemunch.net/r/dv-abc?t=x')).toBe(false);
    expect(isRightsLinkUrl('https://cookiemunch.net/r/dv-abc')).toBe(false);
    expect(isRightsLinkUrl('https://evil.example/?t=x', 'privacy.acme.com')).toBe(false);
    expect(isRightsLinkUrl('https://privacy.acme.com/r/x?t=x', 'privacy.acme.com')).toBe(false);
    expect(isRightsLinkUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('CKM-S-23: <RightsLink mint/>', () => {
  const assign = vi.fn();
  afterEach(() => {
    cleanup();
    assign.mockReset();
  });
  const stubLocation = () => {
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign } });
  };

  it('renders a plain anchor (the fallback href) and does not mint on render', () => {
    const mint = vi.fn();
    render(<RightsLink mint={mint} fallbackHref="https://cookiemunch.net/r/dv-abc">Privacy</RightsLink>);
    expect(screen.getByText('Privacy').getAttribute('href')).toBe('https://cookiemunch.net/r/dv-abc');
    expect(mint).not.toHaveBeenCalled();
  });

  it('mints on click and opens the minted link', async () => {
    stubLocation();
    const mint = vi.fn(async () => ({ url: 'https://privacy.acme.com/?t=a.b', expiresAt: 1, customDomain: 'privacy.acme.com' }));
    render(<RightsLink mint={mint}>Privacy</RightsLink>);
    fireEvent.click(screen.getByText('Privacy'));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://privacy.acme.com/?t=a.b'));
    expect(mint).toHaveBeenCalledTimes(1);
  });

  it('falls back to the plain form when the mint fails or returns something that is not a rights link', async () => {
    stubLocation();
    const onError = vi.fn();
    render(<RightsLink mint={async () => 'https://evil.example/?t=x'} fallbackHref="https://cookiemunch.net/r/dv-abc" onError={onError}>Privacy</RightsLink>);
    fireEvent.click(screen.getByText('Privacy'));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://cookiemunch.net/r/dv-abc'));
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

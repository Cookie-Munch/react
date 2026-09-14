// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, act } from '@testing-library/react';
import { ConsentProvider, useConsent, ConsentGate } from '../src/index.js';
import type { CookieMunchGlobal, PublicConsent } from '../src/types.js';

/**
 * A fake `window.CookieMunch` global standing in for the CDN embed. No network,
 * no `@cookiemunch/core` — the wrapper only ever talks to this global.
 */
function makeFakeCmp(): CookieMunchGlobal {
  let consent: PublicConsent = {
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
  let hasResponse = false;
  const subs = new Set<(s: unknown) => void>();
  const notify = () => subs.forEach((cb) => cb(consent));

  return {
    get consent() {
      return consent;
    },
    get hasResponse() {
      return hasResponse;
    },
    get consented() {
      return hasResponse && (consent.preferences || consent.statistics || consent.marketing);
    },
    show() {},
    renew() {},
    showSettings() {},
    withdraw() {
      consent = { ...consent, preferences: false, statistics: false, marketing: false };
      hasResponse = true;
      notify();
    },
    submitCustomConsent(p, s, m) {
      consent = { ...consent, preferences: p, statistics: s, marketing: m, stamp: 'stamp-1' };
      hasResponse = true;
      notify();
    },
    onConsentChange(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}

afterEach(() => {
  cleanup();
  delete (window as { CookieMunch?: unknown }).CookieMunch;
  for (const s of Array.from(document.querySelectorAll('script'))) s.remove();
});

/** Install a fake global before render so the provider reuses it immediately. */
function withFakeGlobal(): CookieMunchGlobal {
  const cmp = makeFakeCmp();
  (window as { CookieMunch?: CookieMunchGlobal }).CookieMunch = cmp;
  return cmp;
}

function Probe() {
  const { consent, hasResponse, ready, acceptAll, declineAll } = useConsent();
  return (
    <div>
      <span data-testid="ready">{String(ready)}</span>
      <span data-testid="marketing">{String(consent.marketing)}</span>
      <span data-testid="resp">{String(hasResponse)}</span>
      <button onClick={acceptAll}>accept</button>
      <button onClick={declineAll}>decline</button>
    </div>
  );
}

describe('ConsentProvider + useConsent (reusing an existing global)', () => {
  it('provides initial consent state (nothing granted, no response)', async () => {
    withFakeGlobal();
    render(
      <ConsentProvider cbid="cb-react">
        <Probe />
      </ConsentProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
    expect(screen.getByTestId('resp').textContent).toBe('false');
    expect(screen.getByTestId('marketing').textContent).toBe('false');
  });

  it('re-renders consumers when consent is accepted', async () => {
    withFakeGlobal();
    render(
      <ConsentProvider cbid="cb-react">
        <Probe />
      </ConsentProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
    fireEvent.click(screen.getByText('accept'));
    await waitFor(() => expect(screen.getByTestId('marketing').textContent).toBe('true'));
    expect(screen.getByTestId('resp').textContent).toBe('true');
  });

  it('reflects decline', async () => {
    withFakeGlobal();
    render(
      <ConsentProvider cbid="cb-react">
        <Probe />
      </ConsentProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
    fireEvent.click(screen.getByText('decline'));
    await waitFor(() => expect(screen.getByTestId('resp').textContent).toBe('true'));
    expect(screen.getByTestId('marketing').textContent).toBe('false');
  });
});

describe('ConsentProvider (injecting the CDN script)', () => {
  it('injects the embed <script> with data-cbid and resolves once the global appears', async () => {
    render(
      <ConsentProvider cbid="cb-inject" src="https://cdn.cookiemunch.net/consent.js" apiBase="https://api.example.test">
        <Probe />
      </ConsentProvider>,
    );

    // The script tag is injected on mount with the standard embed attributes.
    const tag = document.getElementById('CookieMunch') as HTMLScriptElement | null;
    expect(tag).toBeTruthy();
    expect(tag?.getAttribute('data-cbid')).toBe('cb-inject');
    expect(tag?.getAttribute('data-api')).toBe('https://api.example.test');
    expect(tag?.src).toBe('https://cdn.cookiemunch.net/consent.js');

    // Not ready until the embed reports in.
    expect(screen.getByTestId('ready').textContent).toBe('false');

    // Simulate the embed finishing bootstrap and setting the global.
    act(() => {
      (window as { CookieMunch?: CookieMunchGlobal }).CookieMunch = makeFakeCmp();
    });

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
  });

  it('does not inject a second script when one already exists', async () => {
    withFakeGlobal();
    render(
      <ConsentProvider cbid="cb-react">
        <Probe />
      </ConsentProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
    // Global present up front => no script injected at all.
    expect(document.getElementById('CookieMunch')).toBeNull();
  });
});

describe('ConsentGate', () => {
  it('renders children only after the category is granted', async () => {
    withFakeGlobal();
    render(
      <ConsentProvider cbid="cb-react">
        <ConsentGate category="marketing" fallback={<span>blocked</span>}>
          <span>analytics-here</span>
        </ConsentGate>
        <Probe />
      </ConsentProvider>,
    );
    await waitFor(() => expect(screen.getByText('blocked')).toBeTruthy());
    fireEvent.click(screen.getByText('accept'));
    await waitFor(() => expect(screen.getByText('analytics-here')).toBeTruthy());
  });
});

describe('useConsent outside provider', () => {
  it('throws a helpful error', () => {
    function Bad() {
      useConsent();
      return null;
    }
    expect(() => render(<Bad />)).toThrow(/ConsentProvider/);
  });
});

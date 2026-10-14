// @vitest-environment happy-dom
/**
 * `useConsentValue`, `consentCookie` and `useConsentCookie` against a stand-in embed that
 * behaves like the real one: it exposes `window.CookieMunch.consent` (custom category ids
 * at the top level) and announces every decision as `CookieMunchOnChange`, whose detail
 * carries the internal state (custom ids under `custom`).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { ConsentProvider, useConsentValue, useConsentCookie, consentCookie, isGranted } from '../src/index.js';
import type { CookieMunchGlobal, PublicConsent } from '../src/types.js';

type Choices = { preferences: boolean; statistics: boolean; marketing: boolean; custom?: Record<string, boolean> };

/** A fake embed. `decide()` is a decision of any cause: it updates state and announces it. */
function installEmbed(initial: Choices = { preferences: false, statistics: false, marketing: false }) {
  let state: Choices = initial;
  let previous: Choices | null = null;
  const subs = new Set<(s: unknown) => void>();
  const snapshot = (): PublicConsent => ({
    necessary: true,
    preferences: state.preferences,
    statistics: state.statistics,
    marketing: state.marketing,
    personalizedAds: state.marketing,
    basicAds: state.marketing,
    adProfiling: state.marketing,
    adMeasurement: state.marketing,
    stamp: 's',
    ...(state.custom ?? {}),
  });
  const api: CookieMunchGlobal = {
    get consent() {
      return snapshot();
    },
    get consented() {
      return state.preferences || state.statistics || state.marketing;
    },
    hasResponse: true,
    show() {},
    renew() {},
    showSettings() {},
    withdraw() {
      decide({ preferences: false, statistics: false, marketing: false, custom: { chat: false } }, 'withdraw');
    },
    submitCustomConsent(p, s, m) {
      decide({ preferences: p, statistics: s, marketing: m }, 'selection');
    },
    onConsentChange(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
  function decide(next: Choices, cause = 'selection') {
    previous = state;
    state = next;
    const consent = { necessary: true, ...next, method: 'explicit', stamp: 's', ver: 1, utc: 1, region: 'de' };
    act(() => {
      subs.forEach((cb) => cb(consent));
      window.dispatchEvent(new CustomEvent('CookieMunchOnChange', { detail: { consent, previous, cause } }));
    });
  }
  window.CookieMunch = api;
  return { api, decide };
}

/** The cookie jar as a name → value map. */
function jar(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of document.cookie.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

afterEach(() => {
  cleanup();
  delete (window as { CookieMunch?: unknown }).CookieMunch;
  for (const name of Object.keys(jar())) document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
});

describe('isGranted', () => {
  it('reads standard, top-level custom, and nested custom categories; necessary always', () => {
    expect(isGranted({ marketing: true }, 'marketing')).toBe(true);
    expect(isGranted({ chat: true }, 'chat')).toBe(true);
    expect(isGranted({ custom: { chat: true } }, 'chat')).toBe(true);
    expect(isGranted({ custom: { chat: false } }, 'chat')).toBe(false);
    expect(isGranted(null, 'marketing')).toBe(false);
    expect(isGranted(null, 'necessary')).toBe(true);
  });
});

describe('consentCookie', () => {
  it('writes nothing before the embed reports, writes on grant, removes on withdrawal', () => {
    const stop = consentCookie('aff', 'marketing', 'ref-42');
    expect(jar().aff).toBeUndefined();

    const { decide, api } = installEmbed();
    decide({ preferences: false, statistics: false, marketing: true }, 'accept');
    expect(jar().aff).toBe('ref-42');

    api.withdraw();
    expect(jar().aff).toBeUndefined();
    stop();
  });

  it('applies the current decision immediately when the embed is already loaded', () => {
    installEmbed({ preferences: false, statistics: true, marketing: false });
    const stop = consentCookie('ab', 'statistics', 'B');
    expect(jar().ab).toBe('B');
    stop();
  });

  it('removes a cookie left from an earlier visit when consent no longer holds', () => {
    document.cookie = 'ab=A; path=/';
    installEmbed();
    const stop = consentCookie('ab', 'statistics', 'B');
    expect(jar().ab).toBeUndefined();
    stop();
  });

  it('works with a custom category', () => {
    const { decide } = installEmbed();
    const stop = consentCookie('chat_session', 'chat', 'xyz');
    decide({ preferences: false, statistics: false, marketing: false, custom: { chat: true } });
    expect(jar().chat_session).toBe('xyz');
    decide({ preferences: true, statistics: true, marketing: true, custom: { chat: false } });
    expect(jar().chat_session).toBeUndefined();
    stop();
  });

  it('a lazy value is generated only with consent, and a stored one is kept', () => {
    let calls = 0;
    const gen = () => `id-${++calls}`;
    const { decide } = installEmbed();
    const stop = consentCookie('uid', 'statistics', gen);
    expect(calls).toBe(0);
    decide({ preferences: false, statistics: true, marketing: false });
    expect(jar().uid).toBe('id-1');
    // A repeated announcement of the same grant does not regenerate.
    decide({ preferences: true, statistics: true, marketing: false });
    expect(calls).toBe(1);
    stop();
    // Next page load: the cookie is there, so the id survives.
    const again = consentCookie('uid', 'statistics', gen);
    expect(jar().uid).toBe('id-1');
    expect(calls).toBe(1);
    again();
  });

  it('stops following after the returned function is called', () => {
    const { decide } = installEmbed();
    const stop = consentCookie('aff', 'marketing', 'x');
    stop();
    decide({ preferences: false, statistics: false, marketing: true });
    expect(jar().aff).toBeUndefined();
  });

  it('writes the attributes asked for, and deletes with the same path and domain', () => {
    const writes: string[] = [];
    const original = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => '', set: (v: string) => void writes.push(v) });
    try {
      const { decide } = installEmbed();
      const stop = consentCookie('aff', 'marketing', 'a b', { maxAgeDays: 30, domain: 'example.com', path: '/shop', sameSite: 'Strict' });
      decide({ preferences: false, statistics: false, marketing: true });
      decide({ preferences: false, statistics: false, marketing: false });
      stop();
      const set = writes.find((w) => w.startsWith('aff=a%20b'))!;
      expect(set).toContain('max-age=2592000');
      expect(set).toContain('domain=example.com');
      expect(set).toContain('path=/shop');
      expect(set).toContain('SameSite=Strict');
      const del = writes.at(-1)!;
      expect(del).toMatch(/^aff=;/);
      expect(del).toContain('max-age=0');
      expect(del).toContain('domain=example.com');
      expect(del).toContain('path=/shop');
    } finally {
      delete (document as unknown as Record<string, unknown>).cookie;
      if (original) Object.defineProperty(Document.prototype, 'cookie', original);
    }
  });
});

function Value({ category }: { category: string }) {
  return <span data-testid={category}>{String(useConsentValue(category))}</span>;
}

describe('useConsentValue', () => {
  it('inside a ConsentProvider: follows every change, custom categories included', async () => {
    const { decide } = installEmbed();
    render(
      <ConsentProvider cbid="cb">
        <Value category="marketing" />
        <Value category="chat" />
        <Value category="necessary" />
      </ConsentProvider>,
    );
    expect(screen.getByTestId('marketing').textContent).toBe('false');
    expect(screen.getByTestId('necessary').textContent).toBe('true');
    decide({ preferences: false, statistics: false, marketing: true, custom: { chat: true } });
    expect(screen.getByTestId('marketing').textContent).toBe('true');
    expect(screen.getByTestId('chat').textContent).toBe('true');
    decide({ preferences: false, statistics: false, marketing: false, custom: { chat: false } }, 'withdraw');
    expect(screen.getByTestId('marketing').textContent).toBe('false');
    expect(screen.getByTestId('chat').textContent).toBe('false');
  });

  it('without a provider: reads the embed on the page and follows CookieMunchOnChange', () => {
    const { decide } = installEmbed();
    render(<Value category="statistics" />);
    expect(screen.getByTestId('statistics').textContent).toBe('false');
    decide({ preferences: false, statistics: true, marketing: false });
    expect(screen.getByTestId('statistics').textContent).toBe('true');
  });

  it('without a provider or an embed: false', () => {
    render(<Value category="statistics" />);
    expect(screen.getByTestId('statistics').textContent).toBe('false');
  });
});

describe('useConsentCookie', () => {
  function Affiliate() {
    useConsentCookie('aff', 'marketing', 'ref-7', { maxAgeDays: 30 });
    return null;
  }

  it('writes while the component is mounted and consent holds, removes on withdrawal', () => {
    const { decide, api } = installEmbed();
    render(<Affiliate />);
    expect(jar().aff).toBeUndefined();
    decide({ preferences: false, statistics: false, marketing: true });
    expect(jar().aff).toBe('ref-7');
    api.withdraw();
    expect(jar().aff).toBeUndefined();
  });
});

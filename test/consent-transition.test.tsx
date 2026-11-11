// @vitest-environment happy-dom
/** FormFlow CM-10: onConsentCategory and useConsentTransition fire on transitions only and flag the replay. */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { onConsentCategory, useConsentTransition, type ConsentTransition } from '../src/index.js';

const tick = () => new Promise((r) => setTimeout(r, 0));
function embed(stats: boolean | null) {
  (window as unknown as { CookieMunch?: unknown }).CookieMunch = stats === null
    ? { hasResponse: false, consent: { necessary: true } }
    : { hasResponse: true, consent: { necessary: true, statistics: stats } };
}
const change = (stats: boolean, cause = 'banner') =>
  window.dispatchEvent(new CustomEvent('CookieMunchOnChange', { detail: { consent: { necessary: true, statistics: stats }, cause } }));

afterEach(() => { cleanup(); delete (window as unknown as { CookieMunch?: unknown }).CookieMunch; });

describe('onConsentCategory', () => {
  it('replays a stored grant once, then only real changes, with the cause', async () => {
    embed(true);
    const seen: ConsentTransition[] = [];
    const off = onConsentCategory('statistics', (t) => seen.push(t));
    await tick();
    change(true); // the same state again: nothing (Watchtower started a second session on this)
    change(false, 'withdraw');
    change(false);
    change(true, 'api');
    off();
    change(false);
    expect(seen).toEqual([
      { granted: true, previous: undefined, replay: true, cause: 'replay' },
      { granted: false, previous: true, replay: false, cause: 'withdraw' },
      { granted: true, previous: false, replay: false, cause: 'api' },
    ]);
  });

  it('before a decision there is no replay; the first decision is a real transition', async () => {
    embed(null);
    const seen: ConsentTransition[] = [];
    onConsentCategory('statistics', (t) => seen.push(t));
    await tick();
    expect(seen).toEqual([]);
    change(false);
    expect(seen).toEqual([{ granted: false, previous: undefined, replay: false, cause: 'banner' }]);
  });
});

describe('useConsentTransition', () => {
  it('calls the latest callback on transitions', async () => {
    embed(false);
    const seen: boolean[] = [];
    function C() {
      useConsentTransition('statistics', (t) => seen.push(t.granted));
      return null;
    }
    render(<C />);
    await act(tick);
    act(() => change(true));
    act(() => change(true));
    expect(seen).toEqual([false, true]);
  });
});

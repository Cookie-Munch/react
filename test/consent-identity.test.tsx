// @vitest-environment happy-dom
/** FormFlow CM-20: <ConsentIdentity> links on sign-in, queues before the embed, unlinks on sign-out only. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { ConsentIdentity } from '../src/index.js';

type W = { __consent?: { q?: unknown[]; version?: number; identify?: (t: string) => void }; CookieMunch?: { setSyncToken?: (t: string | null) => void } };
const w = window as unknown as W;
const tick = () => act(() => new Promise((r) => setTimeout(r, 0)));

afterEach(() => { cleanup(); vi.useRealTimers(); delete w.__consent; delete w.CookieMunch; });

describe('<ConsentIdentity>', () => {
  it('queues identify before the embed loads, and does nothing for an anonymous visitor', async () => {
    const setSyncToken = vi.fn();
    w.CookieMunch = { setSyncToken };
    const getToken = vi.fn(async () => 'tok-1');
    const { rerender } = render(<ConsentIdentity subject={null} getToken={getToken} />);
    await tick();
    expect(getToken).not.toHaveBeenCalled();
    expect(setSyncToken).not.toHaveBeenCalled(); // an anonymous first render must not clear a sync token
    rerender(<ConsentIdentity subject="u1" getToken={getToken} />);
    await tick();
    expect(w.__consent?.q).toEqual([['identify', 'tok-1']]);
  });

  it('calls the live identify, re-links on a new subject and every 12 hours, and unlinks on sign-out', async () => {
    vi.useFakeTimers();
    const identify = vi.fn();
    const setSyncToken = vi.fn();
    w.__consent = { version: 1, identify };
    w.CookieMunch = { setSyncToken };
    let n = 0;
    const getToken = async () => `tok-${++n}`;
    const { rerender } = render(<ConsentIdentity subject="u1" getToken={getToken} />);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(identify).toHaveBeenLastCalledWith('tok-1');
    await act(() => vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000));
    expect(identify).toHaveBeenLastCalledWith('tok-2');
    rerender(<ConsentIdentity subject="u2" getToken={getToken} />);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(identify).toHaveBeenLastCalledWith('tok-3');
    rerender(<ConsentIdentity subject={null} getToken={getToken} />);
    await act(() => vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000));
    expect(setSyncToken).toHaveBeenCalledWith(null);
    expect(identify).toHaveBeenCalledTimes(3);
  });

  it('a failed or empty mint links nothing', async () => {
    const identify = vi.fn();
    w.__consent = { version: 1, identify };
    render(<ConsentIdentity subject="u1" getToken={async () => { throw new Error('no session'); }} />);
    await tick();
    render(<ConsentIdentity subject="u2" getToken={() => null} />);
    await tick();
    expect(identify).not.toHaveBeenCalled();
  });
});

describe('<ConsentIdentity tokenUrl> (LinkHub CM-L14)', () => {
  it('GETs the route, links its {token}, and retries a 401 once', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => (++calls === 1 ? new Response('', { status: 401 }) : new Response(JSON.stringify({ token: 'tok-url' }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    render(<ConsentIdentity subject="u1" tokenUrl="/api/atlas/token/cookiemunch" />);
    await tick();
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/atlas/token/cookiemunch');
    expect(w.__consent?.q).toEqual([['identify', 'tok-url']]);
    vi.unstubAllGlobals();
  });
});

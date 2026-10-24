// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { useBannerInset } from '../src/index.js';

function Probe({ edge }: { edge?: 'bottom' | 'top' }) {
  return <span data-testid="inset">{useBannerInset(edge)}</span>;
}

/** What the renderer does while a bar shows (ui/layout.ts). */
function publish(bottom: number, top = 0): void {
  const root = document.documentElement.style;
  root.setProperty('--cookiemunch-inset-bottom', `${bottom}px`);
  root.setProperty('--cookiemunch-inset-top', `${top}px`);
  window.dispatchEvent(new CustomEvent('fd:layout', { detail: { bottomInset: bottom, source: 'cookiemunch' } }));
}

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('style');
});

describe('useBannerInset', () => {
  it('is 0 with no banner, follows the bar, and drops back to 0 when it goes', () => {
    render(<Probe />);
    expect(screen.getByTestId('inset').textContent).toBe('0');
    act(() => publish(63));
    expect(screen.getByTestId('inset').textContent).toBe('63');
    act(() => {
      document.documentElement.style.removeProperty('--cookiemunch-inset-bottom');
      window.dispatchEvent(new CustomEvent('fd:layout', { detail: { bottomInset: 0, source: 'cookiemunch' } }));
    });
    expect(screen.getByTestId('inset').textContent).toBe('0');
  });

  it('reads the top inset for a top bar', () => {
    render(<Probe edge="top" />);
    act(() => publish(0, 48));
    expect(screen.getByTestId('inset').textContent).toBe('48');
  });
});

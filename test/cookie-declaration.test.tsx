// @vitest-environment happy-dom
/**
 * CKM-S-10: `<CookieDeclaration/>` renders without a hydration warning, whether or not the
 * embed filled the element before React hydrated, and React never wipes what was drawn.
 * This is the Next.js App Router path: server HTML from renderToString, then hydrateRoot.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { act, useState } from 'react';
import { CookieDeclaration } from '../src/index.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Page({ n }: { n: number }) {
  return (
    <main>
      <p>render {n}</p>
      <CookieDeclaration emptyText="Nothing yet" />
    </main>
  );
}

function Host() {
  const [n, setN] = useState(0);
  (globalThis as { bump?: () => void }).bump = () => setN((x) => x + 1);
  return <Page n={n} />;
}

const drawTable = (el: Element) => {
  el.innerHTML = '<table><tbody><tr><td>_ga</td></tr></tbody></table>';
};

afterEach(() => {
  document.body.innerHTML = '';
  delete (window as { CookieMunch?: unknown }).CookieMunch;
  vi.restoreAllMocks();
});

async function hydrate(fillBefore: boolean) {
  const container = document.createElement('div');
  container.innerHTML = renderToString(<Host />);
  document.body.appendChild(container);
  const mount = container.querySelector('[data-cc="declaration"]')!;
  expect(mount).toBeTruthy();
  expect(mount.getAttribute('data-empty')).toBe('Nothing yet');
  // The embed's MutationObserver / load scan may fill the element before React hydrates.
  if (fillBefore) drawTable(mount);
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const recoverable: unknown[] = [];
  await act(async () => {
    hydrateRoot(container, <Host />, { onRecoverableError: (e) => recoverable.push(e) });
  });
  return { container, mount, errors, recoverable };
}

describe('<CookieDeclaration/>', () => {
  it('hydrates without a warning when the embed filled it first, and keeps the table', async () => {
    const { container, errors, recoverable } = await hydrate(true);
    expect(errors).not.toHaveBeenCalled();
    expect(recoverable).toEqual([]);
    expect(container.querySelector('td')?.textContent).toBe('_ga');
    // A later re-render of the page must not wipe what the embed drew.
    await act(async () => (globalThis as { bump?: () => void }).bump!());
    expect(container.textContent).toContain('render 1');
    expect(container.querySelector('td')?.textContent).toBe('_ga');
    expect(errors).not.toHaveBeenCalled();
  });

  it('asks the embed to draw an element that is still empty after mount (SPA navigation)', async () => {
    const renderDeclaration = vi.fn(async (el?: Element | null) => drawTable(el!));
    (window as unknown as { CookieMunch: unknown }).CookieMunch = { renderDeclaration };
    const { container, errors } = await hydrate(false);
    expect(renderDeclaration).toHaveBeenCalledTimes(1);
    expect(container.querySelector('td')?.textContent).toBe('_ga');
    expect(errors).not.toHaveBeenCalled();
  });

  it('does not ask again when the element is already drawn, and tolerates an embed without the method', async () => {
    const renderDeclaration = vi.fn(async () => {});
    (window as unknown as { CookieMunch: unknown }).CookieMunch = { renderDeclaration };
    await hydrate(true);
    expect(renderDeclaration).not.toHaveBeenCalled();
    (window as unknown as { CookieMunch: unknown }).CookieMunch = {};
    document.body.innerHTML = '';
    const { errors } = await hydrate(false);
    expect(errors).not.toHaveBeenCalled();
  });
});

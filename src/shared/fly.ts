/**
 * Things travel: a card from the seat that played it, chips into the pot, a
 * coin from the payer to the owner. `fly` moves one small element from one
 * place on the page to another and removes it when it lands.
 *
 * It does nothing where it can't or shouldn't run: reduced motion, a missing
 * end point, or an environment without the Web Animations API (tests).
 */

type Place = Element | DOMRect | null | undefined;

export interface FlyOptions {
  from: Place;
  to: Place;
  /** Builds the travelling element (a card back, a chip, a coin). */
  make: () => HTMLElement;
  ms?: number;
  delay?: number;
  /** Its size on landing, relative to its size on leaving. */
  scaleTo?: number;
}

const rectOf = (p: Place): DOMRect | null => (!p ? null : p instanceof Element ? p.getBoundingClientRect() : p);

export function canFly(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  if (typeof Element.prototype.animate !== 'function') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function fly({ from, to, make, ms = 460, delay = 0, scaleTo = 1 }: FlyOptions): void {
  if (!canFly()) return;
  const a = rectOf(from);
  const b = rectOf(to);
  if (!a || !b || (a.width === 0 && a.height === 0) || (b.width === 0 && b.height === 0)) return;
  const el = make();
  el.style.position = 'fixed';
  el.style.left = '0';
  el.style.top = '0';
  el.style.zIndex = '60';
  el.style.margin = '0';
  el.style.pointerEvents = 'none';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const at = (r: DOMRect) => `translate(${r.left + r.width / 2 - w / 2}px, ${r.top + r.height / 2 - h / 2}px)`;
  const anim = el.animate(
    [
      { transform: `${at(a)} scale(1)`, opacity: 0 },
      { opacity: 1, offset: 0.12 },
      { transform: `${at(b)} scale(${scaleTo})`, opacity: 1, offset: 0.88 },
      { transform: `${at(b)} scale(${scaleTo})`, opacity: 0 },
    ],
    { duration: ms, delay, easing: 'cubic-bezier(0.3, 0, 0.3, 1)', fill: 'both' },
  );
  const done = () => el.remove();
  anim.onfinish = done;
  anim.oncancel = done;
}

/** A plain element of a class, for `make`. */
export function flyer(className: string, text?: string, style?: Partial<CSSStyleDeclaration>): () => HTMLElement {
  return () => {
    const el = document.createElement('span');
    el.className = className;
    if (text) el.textContent = text;
    if (style) Object.assign(el.style, style);
    return el;
  };
}

/** Stamps a word over a place on the page (a lot just sold): it lands, holds, and fades. */
export function stamp(on: Place, text: string, className: string, color?: string, delay = 0): void {
  if (!canFly()) return;
  const r = rectOf(on);
  if (!r || (r.width === 0 && r.height === 0)) return;
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, { position: 'fixed', left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px`, zIndex: '60', pointerEvents: 'none' });
  if (color) el.style.setProperty('--tc', color);
  document.body.appendChild(el);
  const anim = el.animate(
    [
      { transform: 'translate(-50%, -50%) rotate(-12deg) scale(2.6)', opacity: 0 },
      { transform: 'translate(-50%, -50%) rotate(-12deg) scale(1)', opacity: 1, offset: 0.18 },
      { transform: 'translate(-50%, -50%) rotate(-12deg) scale(1)', opacity: 1, offset: 0.8 },
      { transform: 'translate(-50%, -50%) rotate(-12deg) scale(1)', opacity: 0 },
    ],
    { duration: 1700, delay, easing: 'ease-out', fill: 'both' },
  );
  const done = () => el.remove();
  anim.onfinish = done;
  anim.oncancel = done;
}

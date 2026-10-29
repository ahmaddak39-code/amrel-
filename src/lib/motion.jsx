// Система анимаций AMREL: появление при прокрутке, разбивка текста, параллакс, прогресс прокрутки.
// Все эффекты описаны в CSS (styles/motion.css) и включаются классом .is-in.
import { Fragment, createElement, useEffect, useLayoutEffect, useRef, useState } from 'react';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useInView(ref, { once = true, threshold = 0.18, rootMargin = '0px 0px -8% 0px', enabled = true } = {}) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    if (!('IntersectionObserver' in window)) { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); if (once) io.disconnect(); }
      else if (!once) setInView(false);
    }, { threshold, rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, once, threshold, rootMargin, enabled]);
  return inView;
}

/** Обёртка, которая проявляет содержимое при попадании в экран.
 *  variant: up | fade | mask | scale | clip-x | clip-y | left | right | line */
export function Reveal({ as = 'div', variant = 'up', delay = 0, className = '', threshold, when, children, style, ...rest }) {
  const ref = useRef(null);
  const seen = useInView(ref, { threshold, enabled: when === undefined });
  const on = when === undefined ? seen : when;
  return createElement(as, {
    ref, className: `rv rv--${variant} ${on ? 'is-in' : ''} ${className}`.trim(),
    style: { ...style, '--d': `${delay}ms` }, ...rest,
  }, children);
}

/** Разбивает текст на слова или буквы, каждая выходит из-под маски по очереди. */
export function SplitText({ text, as = 'span', by = 'words', stagger = 60, delay = 0, variant = 'rise', className = '', when, threshold = 0.3, ...rest }) {
  const ref = useRef(null);
  const seen = useInView(ref, { threshold, enabled: when === undefined });
  const on = when === undefined ? seen : when;
  const words = String(text).split(' ');
  let i = 0;
  const content = words.map((w, wi) => {
    const inner = by === 'chars'
      ? [...w].map((ch, ci) => <span key={ci} className="st__c" style={{ '--i': i++ }}>{ch}</span>)
      : <span className="st__c" style={{ '--i': i++ }}>{w}</span>;
    return (
      <Fragment key={wi}>
        <span className="st__w"><span className="st__m">{inner}</span></span>
        {wi < words.length - 1 ? ' ' : null}
      </Fragment>
    );
  });
  return createElement(as, {
    ref, className: `st st--${variant} ${on ? 'is-in' : ''} ${className}`.trim(),
    style: { '--stagger': `${stagger}ms`, '--d': `${delay}ms` }, 'aria-label': text, ...rest,
  }, <span aria-hidden="true">{content}</span>);
}

// --- общий цикл прокрутки (один слушатель на весь сайт) ---
const subs = new Set();
let ticking = false;
function loop() {
  ticking = false;
  subs.forEach((fn) => fn());
}
function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(loop); } }
function subscribe(fn) {
  if (!subs.size) { window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll); }
  subs.add(fn); fn();
  return () => { subs.delete(fn); if (!subs.size) { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); } };
}

/** Мягкий параллакс: элемент смещается на speed * (позиция относительно центра экрана). */
export function useParallax(ref, speed = 0.12, { scale = 1 } = {}) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    return subscribe(() => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) return;
      const center = r.top + r.height / 2 - innerHeight / 2;
      el.style.transform = `translate3d(0, ${(-center * speed).toFixed(1)}px, 0) scale(${scale})`;
    });
  }, [ref, speed, scale]);
}

/** Прогресс прохождения элемента через экран: 0 — только показался снизу, 1 — центр экрана. */
export function useScrollProgress(ref, { start = 1, end = 0.5 } = {}) {
  const [p, setP] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) { setP(1); return; }
    return subscribe(() => {
      const r = el.getBoundingClientRect();
      const from = innerHeight * start; const to = innerHeight * end;
      const v = Math.min(1, Math.max(0, (from - r.top) / (from - to)));
      setP((old) => (Math.abs(old - v) > 0.004 ? v : old));
    });
  }, [ref, start, end]);
  return p;
}

export function useScrollY(threshold = 0) {
  const [state, setState] = useState({ y: 0, dir: 'up' });
  useEffect(() => {
    let last = window.scrollY;
    return subscribe(() => {
      const y = window.scrollY;
      const dir = y > last + 4 ? 'down' : y < last - 4 ? 'up' : null;
      if (dir || Math.abs(y - last) > threshold) last = y;
      setState((s) => (s.y === y && (!dir || s.dir === dir) ? s : { y, dir: dir || s.dir }));
    });
  }, [threshold]);
  return state;
}

/** FLIP-анимация перестановки элементов сетки (каталог, фильтры, сортировка). */
export function useFlip(containerRef, deps) {
  const prev = useRef(new Map());
  useLayoutEffect(() => {
    const box = containerRef.current;
    if (!box) return;
    const items = [...box.querySelectorAll('[data-flip]')];
    const reduce = prefersReducedMotion();
    const pos = (el) => { const r = el.getBoundingClientRect(); return { left: r.left + scrollX, top: r.top + scrollY }; };
    let fresh = 0;
    items.forEach((el) => {
      const key = el.dataset.flip;
      const now = pos(el);
      const old = prev.current.get(key);
      if (reduce) return;
      if (old) {
        const dx = old.left - now.left; const dy = old.top - now.top;
        if (dx || dy) {
          el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0,0)' }],
            { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)' });
        }
      } else if (prev.current.size) {
        el.animate([{ opacity: 0, transform: 'translateY(28px) scale(.97)' }, { opacity: 1, transform: 'none' }],
          { duration: 700, delay: Math.min(fresh++ * 60, 420), easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
      }
    });
    const map = new Map();
    items.forEach((el) => map.set(el.dataset.flip, pos(el)));
    prev.current = map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

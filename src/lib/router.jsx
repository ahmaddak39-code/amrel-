import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { prefersReducedMotion } from './motion.jsx';

const RouterCtx = createContext(null);

// В онлайн-превью (статическая сборка) адрес страницы хранится в простом #имени:
// #catalog, #product-tokyo-drive, #about. На настоящем сервере — обычные адреса /catalog и т.д.
export const STATIC = typeof __STATIC__ !== 'undefined' && __STATIC__;
const memSearch = {}; // параметры (фильтры, цвет) отдельно для каждой страницы
const SECTIONS = ['about', 'contacts'];
function fromHash() {
  const name = decodeURIComponent(location.hash.slice(1));
  if (!name || name === 'home') return { path: '/', search: '', hash: '' };
  if (SECTIONS.includes(name)) return { path: '/', search: '', hash: `#${name}` };
  if (name.startsWith('product-')) return { path: `/product/${name.slice(8)}`, search: memSearch[name] || '', hash: '' };
  return { path: `/${name}`, search: memSearch[name] || '', hash: '' };
}
export function hashName(path, hash = '') {
  if (path === '/' || path === '') return hash ? hash.slice(1) : '';
  const pm = path.match(/^\/product\/([\w-]+)/);
  if (pm) return `product-${pm[1]}`;
  return path.replace(/^\/|\/$/g, '').replace(/\//g, '-');
}
function staticHref(to) {
  if (/^https?:/.test(to)) return to;
  const u = new URL(to, 'http://x/');
  const n = hashName(u.pathname, u.hash);
  return n ? `#${n}` : '#home';
}
const readLoc = () => (STATIC ? fromHash() : { path: location.pathname, search: location.search, hash: location.hash });

function scrollToHash(hash, smooth) {
  if (!hash) return false;
  const el = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!el) return false;
  const top = el.getBoundingClientRect().top + window.scrollY - 72;
  window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  return true;
}

export function RouterProvider({ children }) {
  const [loc, setLoc] = useState(readLoc);
  const [phase, setPhase] = useState('idle'); // idle | out | in
  const timers = useRef([]);
  const busy = useRef(false);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const navigate = useCallback((to, { replace = false, scroll = true } = {}) => {
    const cur = readLoc();
    const url = new URL(to, STATIC ? `http://x${cur.path}` : location.href);
    if (!STATIC && url.origin !== location.origin) { location.href = to; return; }
    const next = { path: url.pathname, search: url.search, hash: url.hash };
    const samePage = next.path === cur.path;
    if (STATIC) {
      const n = hashName(url.pathname, url.hash) || 'home';
      memSearch[n] = url.search;
      if (location.hash.slice(1) !== n) history[replace ? 'replaceState' : 'pushState'](null, '', `#${n}`);
    } else {
      history[replace ? 'replaceState' : 'pushState'](null, '', url.pathname + url.search + url.hash);
    }

    if (samePage) {
      setLoc(next);
      if (next.hash) scrollToHash(next.hash, true);
      else if (scroll && next.search === cur.search) window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    clear();
    const swap = () => {
      setLoc(next);
      requestAnimationFrame(() => {
        if (!scrollToHash(next.hash, false) && scroll) window.scrollTo(0, 0);
        setTimeout(() => scrollToHash(next.hash, false), 120);
      });
    };
    if (prefersReducedMotion() || busy.current) { swap(); setPhase('idle'); return; }
    busy.current = true;
    setPhase('out');
    timers.current.push(setTimeout(() => { swap(); setPhase('in'); }, 520));
    timers.current.push(setTimeout(() => { setPhase('idle'); busy.current = false; }, 1150));
  }, []);

  useEffect(() => {
    const onPop = () => { clear(); busy.current = false; setPhase('idle'); setLoc(readLoc()); };
    window.addEventListener('popstate', onPop);
    if (STATIC) window.addEventListener('hashchange', onPop);
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const first = readLoc();
    if (first.hash) setTimeout(() => scrollToHash(first.hash, true), 900);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('hashchange', onPop); };
  }, []);

  const value = useMemo(() => ({ ...loc, query: new URLSearchParams(loc.search), navigate, phase }), [loc, navigate, phase]);
  return <RouterCtx.Provider value={value}>{children}</RouterCtx.Provider>;
}

export const useRouter = () => useContext(RouterCtx);

export function Link({ to, onClick, children, replace, scroll, ...rest }) {
  const { navigate } = useRouter();
  const handle = (e) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target) return;
    e.preventDefault();
    navigate(to, { replace, scroll });
  };
  return <a href={STATIC ? staticHref(to) : to} onClick={handle} {...rest}>{children}</a>;
}

// Анимированный переход между страницами: чёрная шторка с оранжевой кромкой
export function PageCurtain() {
  const { phase } = useRouter();
  return (
    <div className={`curtain curtain--${phase}`} aria-hidden="true">
      <div className="curtain__panel"><span className="curtain__edge" /></div>
    </div>
  );
}

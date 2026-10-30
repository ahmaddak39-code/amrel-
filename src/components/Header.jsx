import { useEffect, useState } from 'react';
import { Link, useRouter } from '../lib/router.jsx';
import { useScrollY } from '../lib/motion.jsx';
import { useCart } from '../lib/cart.jsx';
import { useStore } from '../lib/store.jsx';
import { Logo } from './Logo.jsx';
import { IconBag } from './Icons.jsx';
import { waLink, telLink, igLink } from '../lib/format.js';

const NAV = [
  { to: '/', label: 'Главная', id: 'home' },
  { to: '/catalog', label: 'Каталог', id: 'catalog' },
  { to: '/#about', label: 'О бренде', id: 'about' },
  { to: '/#contacts', label: 'Контакты', id: 'contacts' },
];

/** Какой пункт меню активен: на главной — по секции в центре экрана */
function useActive() {
  const { path } = useRouter();
  const [section, setSection] = useState('home');
  useEffect(() => {
    if (path !== '/') return;
    const ids = ['about', 'contacts'];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setSection(e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    const t = setTimeout(() => ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); }), 400);
    const onTop = () => { if (scrollY < innerHeight * 0.5) setSection('home'); };
    window.addEventListener('scroll', onTop, { passive: true });
    return () => { clearTimeout(t); io.disconnect(); window.removeEventListener('scroll', onTop); };
  }, [path]);
  if (path.startsWith('/catalog') || path.startsWith('/product')) return 'catalog';
  if (path === '/') return section;
  return '';
}

export default function Header() {
  const { y, dir } = useScrollY();
  const { count, setOpen, bump } = useCart();
  const { introDone, settings } = useStore();
  const { path } = useRouter();
  const [menu, setMenu] = useState(false);
  const active = useActive();
  const [bumping, setBumping] = useState(false);

  useEffect(() => { if (!bump) return; setBumping(true); const t = setTimeout(() => setBumping(false), 700); return () => clearTimeout(t); }, [bump]);
  useEffect(() => { setMenu(false); }, [path]);
  useEffect(() => {
    document.documentElement.classList.toggle('menu-lock', menu);
    return () => document.documentElement.classList.remove('menu-lock'); // меню закрывается при уходе со страницы
  }, [menu]);

  const solid = y > 40 || path !== '/';
  const hidden = y > 280 && dir === 'down' && !menu;
  const c = settings?.contacts || {};

  return (
    <>
      <header className={`hdr ${solid ? 'is-solid' : ''} ${hidden ? 'is-hidden' : ''} ${introDone ? 'is-ready' : ''} ${menu ? 'is-menu' : ''}`}>
        <div className="hdr__inner">
          <Link to="/" className="hdr__logo" aria-label="AMREL — на главную"><Logo /></Link>
          <nav className="hdr__nav" aria-label="Основное меню">
            {NAV.map((n, i) => (
              <Link key={n.id} to={n.to} className={`nav-link ${active === n.id ? 'is-active' : ''}`} style={{ '--i': i }}
                aria-current={active === n.id ? 'page' : undefined}>{n.label}</Link>
            ))}
          </nav>
          <div className="hdr__actions">
            <button className={`hdr__cart ${bumping ? 'is-bump' : ''}`} onClick={() => setOpen(true)} aria-label={`Корзина, товаров: ${count}`}>
              <IconBag />
              <span className="hdr__cart-label">Корзина</span>
              <span className={`hdr__count ${count ? 'has' : ''}`}>{count}</span>
            </button>
            <button className={`burger ${menu ? 'is-open' : ''}`} onClick={() => setMenu((m) => !m)} aria-label={menu ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={menu}>
              <span /><span />
            </button>
          </div>
        </div>
      </header>

      <div className={`mmenu ${menu ? 'is-open' : ''}`} aria-hidden={!menu}>
        <div className="mmenu__bg" />
        <nav className="mmenu__nav">
          {NAV.map((n, i) => (
            <Link key={n.id} to={n.to} className={`mmenu__link ${active === n.id ? 'is-active' : ''}`} style={{ '--i': i }} tabIndex={menu ? 0 : -1}>
              <span className="mmenu__idx">0{i + 1}</span>
              <span className="mmenu__txt">{n.label}</span>
            </Link>
          ))}
        </nav>
        <Link to="/admin/login" className="mmenu__admin" style={{ '--i': 4 }} tabIndex={menu ? 0 : -1}>
          <span className="mmenu__admin-dot" />Админ-панель<span className="mmenu__admin-note">вход для владельца</span>
        </Link>
        <div className="mmenu__foot" style={{ '--i': 5 }}>
          {c.phone && <a href={telLink(c.phone)} tabIndex={menu ? 0 : -1}>{c.phone}</a>}
          {c.whatsapp && <a href={waLink(c.whatsapp, c.whatsappText)} target="_blank" rel="noopener noreferrer" tabIndex={menu ? 0 : -1}>WhatsApp</a>}
          {c.instagram && <a href={igLink(c.instagram)} target="_blank" rel="noopener noreferrer" tabIndex={menu ? 0 : -1}>Instagram: @{c.instagram}</a>}
        </div>
      </div>
    </>
  );
}

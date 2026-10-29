import { useRef } from 'react';
import { Link } from '../lib/router.jsx';
import { useInView } from '../lib/motion.jsx';
import { useStore } from '../lib/store.jsx';
import { LogoMark } from './Logo.jsx';
import { waLink, telLink, igLink } from '../lib/format.js';

export default function Footer() {
  const ref = useRef(null);
  const on = useInView(ref, { threshold: 0.15 });
  const { settings } = useStore();
  const c = settings?.contacts || {};
  return (
    <footer ref={ref} className={`ftr ${on ? 'is-in' : ''}`}>
      <div className="ftr__top">
        <div className="ftr__brand">
          <LogoMark className="ftr__mark" />
          <p className="ftr__claim">Fearless / Limitless</p>
        </div>
        <nav className="ftr__col" aria-label="Навигация в подвале">
          <span className="ftr__label">Магазин</span>
          {[['/', 'Главная'], ['/catalog', 'Каталог'], ['/#about', 'О бренде'], ['/#contacts', 'Контакты']].map(([to, l], i) => (
            <Link key={to} to={to} className="ftr__link" style={{ '--i': i }}>{l}</Link>
          ))}
        </nav>
        <div className="ftr__col">
          <span className="ftr__label">Связь</span>
          {c.address && <span className="ftr__link" style={{ '--i': 1 }}>{c.address}</span>}
          {c.phone && <a className="ftr__link" style={{ '--i': 2 }} href={telLink(c.phone)}>{c.phone}</a>}
          {c.whatsapp && <a className="ftr__link" style={{ '--i': 3 }} href={waLink(c.whatsapp, c.whatsappText)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
          {c.instagram && <a className="ftr__link" style={{ '--i': 4 }} href={igLink(c.instagram)} target="_blank" rel="noopener noreferrer">Instagram: @{c.instagram}</a>}
        </div>
      </div>
      <div className="ftr__giant" aria-hidden="true">
        {'AMREL'.split('').map((l, i) => <span key={i} className="ftr__gl" style={{ '--i': i }}>{l}</span>)}
        <span className="ftr__gline" />
      </div>
      <div className="ftr__bottom">
        <span>© {new Date().getFullYear()} AMREL</span>
        <Link to="/admin" className="ftr__admin">Панель администратора</Link>
      </div>
    </footer>
  );
}

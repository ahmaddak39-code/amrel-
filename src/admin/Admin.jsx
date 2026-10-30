import { useCallback, useEffect, useState } from 'react';
import { Link, useRouter } from '../lib/router.jsx';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { useStore } from '../lib/store.jsx';
import { Logo } from '../components/Logo.jsx';
import { IconLogout, IconArrowUpRight } from '../components/Icons.jsx';
import Login from './Login.jsx';
import Products from './Products.jsx';
import ProductEditor from './ProductEditor.jsx';
import Categories from './Categories.jsx';
import Orders from './Orders.jsx';
import Content from './Content.jsx';
import Security from './Security.jsx';

const NAV = [
  { to: '/admin', label: 'Товары', match: (p) => p === '/admin' || p.startsWith('/admin/products') },
  { to: '/admin/categories', label: 'Категории', match: (p) => p.startsWith('/admin/categories') },
  { to: '/admin/orders', label: 'Заказы', match: (p) => p.startsWith('/admin/orders') },
  { to: '/admin/content', label: 'Тексты и блоки', match: (p) => p.startsWith('/admin/content') },
  { to: '/admin/security', label: 'Пароль и доступ', match: (p) => p.startsWith('/admin/security') },
];

export default function Admin() {
  const { path, navigate } = useRouter();
  const toast = useToast();
  const { refresh } = useStore();
  const [session, setSession] = useState(null);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try { setData(await api('/api/admin/overview')); }
    catch (e) { if (e.status === 401) setSession({ authenticated: false, configured: true }); else toast.error(e.message); }
  }, [toast]);

  useEffect(() => { api('/api/admin/session').then(setSession).catch(() => setSession({ authenticated: false, configured: true })); }, []);
  useEffect(() => { if (session?.authenticated && !session.mustChange) load(); }, [session, load]);
  useEffect(() => { document.documentElement.classList.add('is-admin'); return () => document.documentElement.classList.remove('is-admin'); }, []);

  // после любых изменений — обновляем и админку, и витрину
  const changed = useCallback(async () => { await load(); refresh().catch(() => {}); }, [load, refresh]);
  // если сессия истекла во время работы
  const guard = useCallback((e) => { if (e.status === 401) { setSession({ authenticated: false, configured: true }); toast.error('Сессия истекла — войдите снова'); return true; } return false; }, [toast]);

  // адрес входа: /admin/login. Без входа любой адрес панели показывает форму входа
  useEffect(() => {
    if (!session) return;
    if (!session.authenticated && path !== '/admin/login') navigate('/admin/login', { replace: true, scroll: false });
    if (session.authenticated && path === '/admin/login') navigate('/admin', { replace: true, scroll: false });
  }, [session, path, navigate]);

  if (!session) return <div className="page-loading" />;
  if (!session.authenticated) return <Login configured={session.configured} onLogin={() => api('/api/admin/session').then(setSession)} />;
  if (session.mustChange) {
    return (
      <div className="adm adm--forced">
        <div className="adm__main"><Security forced guard={guard} onDone={() => setSession({ ...session, mustChange: false })} /></div>
      </div>
    );
  }

  const logout = async () => {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
    setSession({ authenticated: false, configured: true }); setData(null);
    toast.success('Вы вышли из панели');
    navigate('/admin/login', { replace: true });
  };

  let view;
  const em = path.match(/^\/admin\/products\/([\w-]+)$/);
  if (!data) view = <div className="adm-loading">Загрузка…</div>;
  else if (em) view = <ProductEditor key={em[1]} id={em[1]} data={data} onChanged={changed} guard={guard} />;
  else if (path.startsWith('/admin/categories')) view = <Categories data={data} onChanged={changed} guard={guard} />;
  else if (path.startsWith('/admin/orders')) view = <Orders guard={guard} onChanged={changed} />;
  else if (path.startsWith('/admin/content')) view = <Content guard={guard} onChanged={changed} />;
  else if (path.startsWith('/admin/security')) view = <Security guard={guard} storage={data.storage} />;
  else view = <Products data={data} onChanged={changed} guard={guard} />;

  return (
    <div className="adm">
      <aside className="adm__side">
        <Link to="/admin" className="adm__logo"><Logo /><span>Admin</span></Link>
        <nav className="adm__nav">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={`adm__link ${n.match(path) ? 'is-active' : ''}`}>
              {n.label}
              {n.to === '/admin/orders' && data?.newOrders > 0 && <span className="adm__badge">{data.newOrders}</span>}
            </Link>
          ))}
        </nav>
        <div className="adm__side-foot">
          <a href="/" target="_blank" rel="noopener" className="adm__link adm__link--muted">Открыть сайт <IconArrowUpRight width={14} /></a>
          <button className="adm__link adm__link--muted" onClick={logout}><IconLogout width={16} /> Выйти</button>
        </div>
      </aside>
      <div className="adm__main">{view}</div>
    </div>
  );
}

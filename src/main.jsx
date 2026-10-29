import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, PageCurtain, useRouter } from './lib/router.jsx';
import { StoreProvider } from './lib/store.jsx';
import { CartProvider } from './lib/cart.jsx';
import { ToastProvider } from './lib/toast.jsx';
import Intro from './components/Intro.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import Home from './pages/Home.jsx';
import Catalog from './pages/Catalog.jsx';
import Product from './pages/Product.jsx';
import Checkout from './pages/Checkout.jsx';
import NotFound from './pages/NotFound.jsx';
import './styles/index.css';

// Админ-панель загружается отдельно — покупатели её код не скачивают
const Admin = lazy(() => import('./admin/Admin.jsx'));

function Routes() {
  const { path } = useRouter();
  if (path.startsWith('/admin')) {
    return <Suspense fallback={<div className="page-loading" />}><Admin /></Suspense>;
  }
  let page;
  const pm = path.match(/^\/product\/([a-z0-9-]+)\/?$/);
  if (path === '/') page = <Home />;
  else if (/^\/catalog\/?$/.test(path)) page = <Catalog />;
  else if (pm) page = <Product slug={pm[1]} />;
  else if (/^\/checkout\/?$/.test(path)) page = <Checkout />;
  else page = <NotFound />;
  return (
    <>
      <Header />
      <div key={path} className="page-wrap">{page}</div>
      <Footer />
      <CartDrawer />
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StoreProvider>
      <RouterProvider>
        <ToastProvider>
          <CartProvider>
            <Intro />
            <Routes />
            <PageCurtain />
          </CartProvider>
        </ToastProvider>
      </RouterProvider>
    </StoreProvider>
  </StrictMode>,
);

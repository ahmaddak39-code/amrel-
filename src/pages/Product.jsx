import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Link, useRouter } from '../lib/router.jsx';
import { Reveal, SplitText, useInView } from '../lib/motion.jsx';
import Viewer from '../components/Viewer.jsx';
import Accordion from '../components/Accordion.jsx';
import SizeChart from '../components/SizeChart.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { PurchasePanel, Price, useSelection } from '../components/Purchase.jsx';
import { IconArrow } from '../components/Icons.jsx';
import NotFound from './NotFound.jsx';

function Inner({ product }) {
  const { catalog, settings } = useStore();
  const { query, navigate, path } = useRouter();
  const sel = useSelection(product, query.get('color'));
  const [chart, setChart] = useState(false);
  const buyRef = useRef(null);
  const buyVisible = useInView(buyRef, { once: false, threshold: 0, rootMargin: '0px' });
  const category = catalog.categories.find((c) => c.id === product.categoryId);
  const hasChart = settings?.sizeChart?.rows?.length > 0;

  // выбранный цвет — в адресе страницы, чтобы ссылкой можно было поделиться
  useEffect(() => {
    if (sel.variant && query.get('color') !== sel.variant.id && product.variants.length > 1) {
      navigate(`${path}?color=${sel.variant.id}`, { replace: true, scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.variant?.id]);

  const related = useMemo(() => catalog.products.filter((p) => p.id !== product.id && p.categoryId === product.categoryId).slice(0, 4), [catalog, product]);

  return (
    <main className="page page--product">
      <nav className="crumbs" aria-label="Навигация">
        <Link to="/">Главная</Link><span>/</span><Link to="/catalog">Каталог</Link>
        {category && <><span>/</span><Link to={`/catalog?category=${category.slug}`}>{category.name}</Link></>}
      </nav>

      <div className="pdp">
        <Reveal variant="clip-y" className="pdp__media">
          <Viewer images={sel.variant.images} spin={sel.variant.spin} alt={`${product.name}, ${sel.variant.name}`} variantKey={sel.variant.id} />
        </Reveal>

        <div className="pdp__info">
          <div className="pdp__sticky">
            <Reveal variant="fade" className="pdp__tags">
              {category && <span>{category.name}</span>}
              {product.isNew && <span className="is-accent">New</span>}
              {product.salePrice != null && <span className="is-accent">Sale</span>}
            </Reveal>
            <SplitText as="h1" text={product.name} by="words" stagger={70} className="pdp__title" />
            <Reveal variant="up" delay={250}><Price product={product} className="pdp__price" /></Reveal>
            <Reveal variant="up" delay={350} className="pdp__buy">
              <div ref={buyRef}>
                <PurchasePanel product={product} sel={sel} onChart={hasChart ? () => setChart(true) : undefined} />
              </div>
            </Reveal>
            <Reveal variant="up" delay={450}>
              <Accordion items={[
                { title: 'Описание', content: product.description },
                { title: 'Состав и уход', content: product.details },
                { title: 'Доставка и оплата', content: settings?.delivery },
              ]} />
            </Reveal>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="section related">
          <div className="shead">
            <Reveal variant="line" className="shead__meta"><span className="shead__idx">+</span><span className="shead__label">Ещё из коллекции</span></Reveal>
            <SplitText as="h2" text="Вам может понравиться" className="shead__title" />
            <Link to="/catalog" className="arrow-link">Весь каталог <IconArrow width={16} /></Link>
          </div>
          <RelatedGrid list={related} />
        </section>
      )}

      {/* мобильная панель «в корзину», когда основной блок ушёл за экран */}
      <div className={`pdp-bar ${!buyVisible ? 'is-on' : ''}`}>
        <div className="pdp-bar__info"><b>{product.name}</b><Price product={product} /></div>
        <button className="btn btn--accent btn--sm" onClick={() => buyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
          <span>{product.price != null ? 'Выбрать размер' : 'Узнать цену'}</span>
        </button>
      </div>
      <SizeChart open={chart} onClose={() => setChart(false)} />
    </main>
  );
}

function RelatedGrid({ list }) {
  const ref = useRef(null);
  const on = useInView(ref, { threshold: 0.1 });
  return <div ref={ref} className={`grid grid--4 stagger ${on ? 'is-in' : ''}`}>{list.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}</div>;
}

export default function Product({ slug }) {
  const { catalog, bySlug } = useStore();
  if (!catalog) return <div className="page-loading" />;
  const product = bySlug(slug);
  if (!product) return <NotFound text="Такого товара нет или он снят с продажи." />;
  return <Inner key={product.id} product={product} />;
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { useRouter } from '../lib/router.jsx';
import { Reveal, SplitText, useFlip } from '../lib/motion.jsx';
import ProductCard from '../components/ProductCard.jsx';
import QuickView from '../components/QuickView.jsx';
import { IconClose, IconFilter, IconSearch } from '../components/Icons.jsx';
import { unitPrice, sortSizes, plural, rub } from '../lib/format.js';

const SORTS = [
  { id: 'featured', label: 'Избранные' },
  { id: 'new', label: 'Новые' },
  { id: 'price-asc', label: 'Цена ↑' },
  { id: 'price-desc', label: 'Цена ↓' },
];

export default function Catalog() {
  const { catalog } = useStore();
  const { query, navigate, path } = useRouter();
  const [quick, setQuick] = useState(null);
  const [sheet, setSheet] = useState(false);
  const grid = useRef(null);

  const cat = query.get('category') || 'all';
  const colors = query.getAll('color');
  const sizes = query.getAll('size');
  const q = query.get('q') || '';
  const sort = query.get('sort') || 'featured';
  const pmin = query.get('min') ? Number(query.get('min')) : null;
  const pmax = query.get('max') ? Number(query.get('max')) : null;
  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);

  const setParams = (mut) => {
    const p = new URLSearchParams(query);
    mut(p);
    const s = p.toString();
    navigate(`${path}${s ? `?${s}` : ''}`, { replace: true, scroll: false });
  };
  const toggle = (key, val) => setParams((p) => {
    const all = p.getAll(key); p.delete(key);
    (all.includes(val) ? all.filter((x) => x !== val) : [...all, val]).forEach((x) => p.append(key, x));
  });
  // поиск с задержкой, чтобы список не дёргался на каждую букву
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => setParams((p) => (search ? p.set('q', search) : p.delete('q'))), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const products = catalog?.products || [];
  const facets = useMemo(() => {
    const colorMap = new Map();
    products.forEach((p) => p.variants.forEach((v) => { if (!colorMap.has(v.name)) colorMap.set(v.name, v.hex); }));
    const allSizes = sortSizes([...new Set(products.flatMap((p) => p.variants.flatMap((v) => v.sizes.filter((s) => s.stock > 0).map((s) => s.size))))]);
    const prices = products.map(unitPrice).filter((x) => x != null);
    return {
      colors: [...colorMap.entries()].map(([name, hex]) => ({ name, hex })),
      sizes: allSizes,
      price: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
      hasNew: products.some((p) => p.isNew),
    };
  }, [products]);

  const tabs = [
    { id: 'all', label: 'Все товары', n: products.length },
    ...(facets.hasNew ? [{ id: 'new', label: 'Новинки', n: products.filter((p) => p.isNew).length }] : []),
    ...(catalog?.categories || []).filter((c) => c.count > 0).map((c) => ({ id: c.slug, label: c.name, n: c.count })),
  ];

  const list = useMemo(() => {
    const catId = catalog?.categories.find((c) => c.slug === cat)?.id;
    const needle = q.trim().toLowerCase();
    let out = products.filter((p) => {
      if (cat === 'new' && !p.isNew) return false;
      if (cat !== 'all' && cat !== 'new' && p.categoryId !== catId) return false;
      if (needle && !`${p.name} ${p.description} ${p.variants.map((v) => v.name).join(' ')}`.toLowerCase().includes(needle)) return false;
      if (colors.length && !p.variants.some((v) => colors.includes(v.name))) return false;
      if (sizes.length && !p.variants.some((v) => v.sizes.some((s) => s.stock > 0 && sizes.includes(s.size) && (!colors.length || colors.includes(v.name))))) return false;
      const price = unitPrice(p);
      if ((pmin != null || pmax != null) && price == null) return false;
      if (pmin != null && price < pmin) return false;
      if (pmax != null && price > pmax) return false;
      return true;
    });
    const priceKey = (p, dir) => unitPrice(p) ?? (dir > 0 ? Infinity : -Infinity);
    if (sort === 'new') out = [...out].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else if (sort === 'price-asc') out = [...out].sort((a, b) => priceKey(a, 1) - priceKey(b, 1));
    else if (sort === 'price-desc') out = [...out].sort((a, b) => priceKey(b, -1) - priceKey(a, -1));
    else out = [...out].sort((a, b) => (b.featured - a.featured) || (a.sort - b.sort));
    return out;
  }, [products, catalog, cat, q, colors.join(), sizes.join(), pmin, pmax, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  useFlip(grid, [list.map((p) => p.id).join()]);
  const activeCount = colors.length + sizes.length + (pmin != null || pmax != null ? 1 : 0);
  const reset = () => setParams((p) => { ['color', 'size', 'min', 'max', 'q'].forEach((k) => p.delete(k)); });
  useEffect(() => {
    document.documentElement.classList.toggle('sheet-lock', sheet);
    return () => document.documentElement.classList.remove('sheet-lock');
  }, [sheet]);

  if (!catalog) return <div className="page-loading" />;

  const filters = (
    <div className="filters">
      {facets.colors.length > 0 && (
        <fieldset className="fgroup">
          <legend>Цвет</legend>
          <div className="fgroup__colors">
            {facets.colors.map((c) => (
              <button key={c.name} className={`fchip fchip--color ${colors.includes(c.name) ? 'is-active' : ''}`} onClick={() => toggle('color', c.name)} aria-pressed={colors.includes(c.name)}>
                <span className="fchip__dot" style={{ '--c': c.hex }} />{c.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {facets.sizes.length > 0 && (
        <fieldset className="fgroup">
          <legend>Размер</legend>
          <div className="fgroup__sizes">
            {facets.sizes.map((s) => (
              <button key={s} className={`fchip fchip--size ${sizes.includes(s) ? 'is-active' : ''}`} onClick={() => toggle('size', s)} aria-pressed={sizes.includes(s)}>{s}</button>
            ))}
          </div>
        </fieldset>
      )}
      {facets.price && facets.price.max > facets.price.min && (
        <fieldset className="fgroup">
          <legend>Цена, ₽</legend>
          <div className="fgroup__price">
            <input type="number" inputMode="numeric" placeholder={`от ${facets.price.min}`} defaultValue={pmin ?? ''} key={`min${pmin}`}
              onBlur={(e) => setParams((p) => (e.target.value ? p.set('min', e.target.value) : p.delete('min')))} aria-label="Цена от" />
            <span>—</span>
            <input type="number" inputMode="numeric" placeholder={`до ${facets.price.max}`} defaultValue={pmax ?? ''} key={`max${pmax}`}
              onBlur={(e) => setParams((p) => (e.target.value ? p.set('max', e.target.value) : p.delete('max')))} aria-label="Цена до" />
          </div>
          <span className="fgroup__range">{rub(facets.price.min)} — {rub(facets.price.max)}</span>
        </fieldset>
      )}
      {activeCount > 0 && <button className="link-btn" onClick={reset}>Сбросить фильтры</button>}
    </div>
  );

  return (
    <main className="page page--catalog">
      <header className="cat-hero">
        <Reveal variant="line" className="shead__meta"><span className="shead__idx">AMREL</span><span className="shead__label">Каталог одежды</span></Reveal>
        <SplitText as="h1" text="Каталог" by="chars" stagger={45} className="cat-hero__title" />
        <Reveal as="p" variant="up" delay={350} className="cat-hero__count">
          {list.length} {plural(list.length, ['модель', 'модели', 'моделей'])}
        </Reveal>
      </header>

      <Reveal variant="fade" delay={250} className="cat-bar">
        <div className="tabs" role="tablist" aria-label="Категории">
          {tabs.map((t, i) => (
            <button key={t.id} role="tab" aria-selected={cat === t.id} className={`tab ${cat === t.id ? 'is-active' : ''}`} style={{ '--i': i }}
              onClick={() => setParams((p) => (t.id === 'all' ? p.delete('category') : p.set('category', t.id)))}>
              {t.label}<sup>{t.n}</sup>
            </button>
          ))}
        </div>
        <div className="cat-tools">
          <label className="search">
            <IconSearch width={18} />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по названию" aria-label="Поиск" />
            {search && <button onClick={() => setSearch('')} aria-label="Очистить поиск"><IconClose width={16} /></button>}
          </label>
          <label className="select">
            <span className="select__label">Сортировка</span>
            <select value={sort} onChange={(e) => setParams((p) => (e.target.value === 'featured' ? p.delete('sort') : p.set('sort', e.target.value)))}>
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          {(facets.colors.length > 0 || facets.sizes.length > 0) && (
            <button className="btn btn--ghost btn--sm cat-filter-btn" onClick={() => setSheet(true)}>
              <IconFilter width={16} /><span>Фильтры{activeCount ? ` · ${activeCount}` : ''}</span>
            </button>
          )}
        </div>
      </Reveal>

      <div className="cat-layout">
        <Reveal as="aside" variant="right" delay={400} className="cat-side">{filters}</Reveal>
        <div className="cat-main">
          {list.length ? (
            <div ref={grid} className="grid grid--catalog stagger is-in">
              {list.map((p, i) => <ProductCard key={p.id} product={p} index={i} eager={i < 3} onQuick={(product, variantId) => setQuick({ product, variantId })} />)}
            </div>
          ) : (
            <div className="cat-empty">
              <p className="cat-empty__title">Ничего не найдено</p>
              <p className="muted">Попробуйте изменить фильтры или поисковый запрос.</p>
              <button className="btn btn--light" onClick={reset}><span>Сбросить фильтры</span></button>
            </div>
          )}
        </div>
      </div>

      <div className={`sheet ${sheet ? 'is-open' : ''}`} aria-hidden={!sheet}>
        <div className="sheet__backdrop" onClick={() => setSheet(false)} />
        <div className="sheet__panel" role="dialog" aria-label="Фильтры">
          <div className="sheet__head"><b>Фильтры</b><button className="icon-btn" onClick={() => setSheet(false)} aria-label="Закрыть"><IconClose /></button></div>
          {filters}
          <button className="btn btn--accent btn--block" onClick={() => setSheet(false)}><span>Показать {list.length} {plural(list.length, ['модель', 'модели', 'моделей'])}</span></button>
        </div>
      </div>
      <QuickView state={quick} onClose={() => setQuick(null)} />
    </main>
  );
}

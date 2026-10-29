import { useEffect, useMemo, useState } from 'react';
import { Link, useRouter } from '../lib/router.jsx';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { ImageList, Toggle, Confirm, PageHead } from './ui.jsx';
import { IconPlus, IconTrash, IconArrowUpRight } from '../components/Icons.jsx';
import { sortSizes } from '../lib/format.js';

const PRESET_COLORS = [
  { name: 'Белый', hex: '#F2F1EC' }, { name: 'Чёрный', hex: '#0E0E0E' }, { name: 'Тёмно-синий', hex: '#1C2B52' },
  { name: 'Синий', hex: '#26408A' }, { name: 'Серый', hex: '#8A8A8A' }, { name: 'Бежевый', hex: '#D8C8AE' },
];
const QUICK_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const EMPTY = { name: '', slug: '', categoryId: '', description: '', details: '', price: '', salePrice: '', featured: false, isNew: true, published: false, variants: [] };

function VariantEditor({ v, index, total, onChange, onRemove, onMove, guard }) {
  const [customSize, setCustomSize] = useState('');
  const set = (k, val) => onChange({ ...v, [k]: val });
  const addSize = (size) => {
    const s = size.trim().toUpperCase();
    if (!s || v.sizes.some((x) => x.size === s)) return;
    const all = [...v.sizes, { size: s, stock: 0 }];
    set('sizes', sortSizes(all.map((x) => x.size)).map((sz) => all.find((x) => x.size === sz)));
  };
  return (
    <div className="var">
      <div className="var__head">
        <span className="var__swatch" style={{ background: v.hex }} />
        <input className="var__name" value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="Название цвета" aria-label="Название цвета" maxLength={40} />
        <label className="var__hex"><input type="color" value={v.hex} onChange={(e) => set('hex', e.target.value.toUpperCase())} aria-label="Оттенок" /><span>{v.hex}</span></label>
        <div className="var__tools">
          <button type="button" className="icon-btn" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Выше">↑</button>
          <button type="button" className="icon-btn" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Ниже">↓</button>
          <button type="button" className="icon-btn icon-btn--danger" onClick={onRemove} aria-label="Удалить цвет"><IconTrash width={16} /></button>
        </div>
      </div>
      <div className="var__presets">
        {PRESET_COLORS.map((c) => <button type="button" key={c.hex} className="chip" onClick={() => onChange({ ...v, name: c.name, hex: c.hex })}><i style={{ background: c.hex }} />{c.name}</button>)}
      </div>

      <div className="var__section">
        <h4>Фото этого цвета</h4>
        <ImageList value={v.images} onChange={(a) => set('images', a)} labels={['Главное фото', 'Спина / 2-е фото']} onMain guard={guard}
          hint="Можно выбрать сразу несколько фото из галереи iPhone. Первое — главное (в каталоге), второе — спина (при наведении и в повороте). «Сделать главным» переносит фото на первое место." />
      </div>

      <div className="var__section">
        <h4>Размеры и остатки</h4>
        {v.sizes.length > 0 && (
          <div className="var__sizes">
            {v.sizes.map((s, i) => (
              <div key={s.size} className={`szrow ${s.stock < 1 ? 'is-out' : ''}`}>
                <b>{s.size}</b>
                <input type="number" min="0" inputMode="numeric" value={s.stock} aria-label={`Остаток ${s.size}`}
                  onChange={(e) => set('sizes', v.sizes.map((x, k) => (k === i ? { ...x, stock: Math.max(0, parseInt(e.target.value || '0', 10)) } : x)))} />
                <span>шт.</span>
                <button type="button" className="icon-btn" onClick={() => set('sizes', v.sizes.filter((_, k) => k !== i))} aria-label={`Убрать размер ${s.size}`}><IconTrash width={14} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="var__addsize">
          {QUICK_SIZES.filter((s) => !v.sizes.some((x) => x.size === s)).map((s) => <button type="button" key={s} className="chip" onClick={() => addSize(s)}>+ {s}</button>)}
          <input value={customSize} onChange={(e) => setCustomSize(e.target.value)} placeholder="Свой размер" maxLength={10}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSize(customSize); setCustomSize(''); } }} />
          <button type="button" className="chip" onClick={() => { addSize(customSize); setCustomSize(''); }}>Добавить</button>
        </div>
        <p className="adm-hint">Размер с остатком 0 покупатель увидит, но выбрать не сможет. Неуказанные размеры не показываются.</p>
      </div>

      <details className="var__section var__spin">
        <summary><h4>Кадры для вращения 360° <small>({v.spin.length})</small></h4></summary>
        <ImageList value={v.spin} onChange={(a) => set('spin', a)} max={72} guard={guard}
          hint="Для настоящего вращения нужны 24–36 фото одной футболки, снятых по кругу с одинаковым шагом (каждые 10–15°), с одной точки и при одинаковом свете. Загружайте по порядку. Режим 360° включится от 8 кадров." />
      </details>
    </div>
  );
}

export default function ProductEditor({ id, data, onChanged, guard }) {
  const isNew = id === 'new';
  const { navigate } = useRouter();
  const toast = useToast();
  const source = useMemo(() => (isNew ? null : data.products.find((p) => p.id === id)), [data, id, isNew]);
  const [f, setF] = useState(() => {
    if (!source) return { ...EMPTY, categoryId: data.categories[0]?.id || '' };
    return { ...source, price: source.price ?? '', salePrice: source.salePrice ?? '', categoryId: source.categoryId || '' };
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [del, setDel] = useState(false);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setDirty(true); };

  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!isNew && !source) return <div className="adm-page"><p className="muted">Товар не найден. <Link to="/admin">К списку</Link></p></div>;

  const save = async (e, publish) => {
    e?.preventDefault();
    const published = publish === undefined ? f.published : publish;
    if (published && !f.variants.some((v) => v.images.length)) { toast.error('Чтобы опубликовать, добавьте хотя бы один цвет с фотографией'); return; }
    setSaving(true);
    const body = { ...f, published, price: f.price === '' ? null : Number(f.price), salePrice: f.salePrice === '' ? null : Number(f.salePrice) };
    try {
      const saved = await api(isNew ? '/api/admin/products' : `/api/admin/products/${id}`, { method: isNew ? 'POST' : 'PUT', body });
      setDirty(false);
      toast.success(published && !f.published ? 'Товар опубликован — он уже в каталоге' : !published && f.published ? 'Товар снят с публикации' : published ? 'Изменения сохранены и видны на сайте' : 'Черновик сохранён');
      await onChanged();
      if (isNew) navigate(`/admin/products/${saved.id}`, { replace: true });
      else setF({ ...saved, price: saved.price ?? '', salePrice: saved.salePrice ?? '', categoryId: saved.categoryId || '' });
    } catch (err) { if (!guard(err)) toast.error(err.message); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    try { await api(`/api/admin/products/${id}`, { method: 'DELETE' }); toast.success('Товар удалён'); setDirty(false); await onChanged(); navigate('/admin'); }
    catch (err) { if (!guard(err)) toast.error(err.message); }
  };
  const setVariant = (i, v) => set('variants', f.variants.map((x, k) => (k === i ? v : x)));
  const moveVariant = (i, d) => { const a = [...f.variants]; const j = i + d; [a[i], a[j]] = [a[j], a[i]]; set('variants', a); };
  const addVariant = () => {
    const used = new Set(f.variants.map((v) => v.hex));
    const c = PRESET_COLORS.find((x) => !used.has(x.hex)) || PRESET_COLORS[0];
    set('variants', [...f.variants, { id: '', name: c.name, hex: c.hex, images: [], spin: [], sizes: [] }]);
  };

  return (
    <form className="adm-page" onSubmit={save}>
      <PageHead title={isNew ? 'Новый товар' : f.name || 'Товар'} sub={<Link to="/admin">← Все товары</Link>}>
        {!isNew && source?.published && <a className="btn btn--ghost btn--sm" href={`/product/${source.slug}`} target="_blank" rel="noopener"><span>На сайте</span><IconArrowUpRight width={14} /></a>}
        <span className={`status-pill ${f.published ? 'is-pub' : ''}`}>{f.published ? 'Опубликован' : 'Черновик'}</span>
        {!isNew && <button type="button" className="btn btn--ghost btn--sm btn--danger-ghost" onClick={() => setDel(true)}><IconTrash width={14} /><span>Удалить</span></button>}
        {f.published ? (
          <>
            <button type="button" className="btn btn--ghost btn--sm" disabled={saving} onClick={() => save(null, false)}><span>Снять с публикации</span></button>
            <button className="btn btn--accent btn--sm" disabled={saving}><span>{saving ? 'Сохраняем…' : 'Сохранить'}</span></button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--ghost btn--sm" disabled={saving} onClick={() => save(null, false)}><span>Сохранить черновик</span></button>
            <button type="button" className="btn btn--accent btn--sm" disabled={saving} onClick={() => save(null, true)}><span>{saving ? 'Сохраняем…' : 'Опубликовать'}</span></button>
          </>
        )}
      </PageHead>

      <div className="adm-grid">
        <section className="adm-card">
          <h3>Основное</h3>
          <label className="field field--wide"><span className="field__label">Название *</span><input value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={120} required /></label>
          <label className="field field--wide"><span className="field__label">Адрес страницы (латиница)</span>
            <span className="slug"><span>/product/</span><input value={f.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} placeholder="создастся из названия" maxLength={80} /></span>
          </label>
          <label className="field field--wide"><span className="field__label">Категория</span>
            <select value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">Без категории</option>
              {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field field--wide"><span className="field__label">Описание</span><textarea rows={5} value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={4000} /></label>
          <label className="field field--wide"><span className="field__label">Состав и уход</span><textarea rows={3} value={f.details} onChange={(e) => set('details', e.target.value)} placeholder="Например: 100% хлопок, плотность … г/м². Стирка при 30°." maxLength={4000} /></label>
        </section>

        <section className="adm-card">
          <h3>Цена и показ</h3>
          <div className="fields">
            <label className="field"><span className="field__label">Цена, ₽</span><input type="number" min="0" inputMode="numeric" value={f.price} onChange={(e) => set('price', e.target.value)} placeholder="не указана" /></label>
            <label className="field"><span className="field__label">Цена со скидкой, ₽</span><input type="number" min="0" inputMode="numeric" value={f.salePrice} onChange={(e) => set('salePrice', e.target.value)} placeholder="без скидки" /></label>
          </div>
          <p className="adm-hint">Без цены товар показывается с пометкой «Цена уточняется» и кнопкой WhatsApp.</p>
          <div className="toggles">
            <Toggle checked={f.featured} onChange={(v) => set('featured', v)} label="На главной странице" hint="Блок «Избранное»" />
            <Toggle checked={f.isNew} onChange={(v) => set('isNew', v)} label="Новинка" hint="Метка New и раздел «Новинки»" />
          </div>
        </section>
      </div>

      <section className="adm-card">
        <div className="adm-card__head"><h3>Цвета, фото и размеры</h3>
          <button type="button" className="btn btn--ghost btn--sm" onClick={addVariant}><IconPlus width={14} /><span>Добавить цвет</span></button>
        </div>
        {!f.variants.length && <p className="muted">Добавьте хотя бы один цвет с фотографиями.</p>}
        {f.variants.map((v, i) => (
          <VariantEditor key={i} v={v} index={i} total={f.variants.length} guard={guard}
            onChange={(nv) => setVariant(i, nv)} onMove={(d) => moveVariant(i, d)}
            onRemove={() => { if (confirm(`Удалить цвет «${v.name}» вместе с его фото и размерами?`)) set('variants', f.variants.filter((_, k) => k !== i)); }} />
        ))}
      </section>

      <div className={`adm-savebar ${dirty ? 'is-on' : ''}`}>
        <span>Есть несохранённые изменения</span>
        {f.published
          ? <button className="btn btn--accent btn--sm" disabled={saving}><span>{saving ? 'Сохраняем…' : 'Сохранить'}</span></button>
          : <button type="button" className="btn btn--accent btn--sm" disabled={saving} onClick={() => save(null, false)}><span>Сохранить черновик</span></button>}
      </div>
      <Confirm open={del} title="Удалить товар?" text={`«${f.name}» будет удалён без возможности восстановления.`} onConfirm={remove} onClose={() => setDel(false)} />
    </form>
  );
}


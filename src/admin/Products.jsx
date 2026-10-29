import { useMemo, useState } from 'react';
import { Link, useRouter } from '../lib/router.jsx';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { rub } from '../lib/format.js';
import { Confirm, PageHead } from './ui.jsx';
import { IconPlus, IconTrash, IconSearch, IconUp, IconDown } from '../components/Icons.jsx';

export default function Products({ data, onChanged, guard }) {
  const { navigate } = useRouter();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const cats = Object.fromEntries(data.categories.map((c) => [c.id, c.name]));
  const list = useMemo(() => data.products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())), [data, q]);

  const patch = async (p, changes, msg) => {
    try { await api(`/api/admin/products/${p.id}`, { method: 'PUT', body: { ...p, ...changes } }); toast.success(msg); onChanged(); }
    catch (e) { if (!guard(e)) toast.error(e.message); }
  };
  const move = async (i, d) => {
    const ids = data.products.map((p) => p.id); const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try { await api('/api/admin/products/reorder', { method: 'POST', body: { ids } }); onChanged(); }
    catch (e) { if (!guard(e)) toast.error(e.message); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api(`/api/admin/products/${del.id}`, { method: 'DELETE' }); toast.success(`«${del.name}» удалён`); setDel(null); onChanged(); }
    catch (e) { if (!guard(e)) toast.error(e.message); }
    finally { setBusy(false); }
  };

  const noPrice = data.products.filter((p) => p.price == null).length;
  const noSizes = data.products.filter((p) => p.variants.every((v) => !v.sizes.length)).length;

  return (
    <div className="adm-page">
      <PageHead title="Товары" sub={`${data.products.length} в каталоге`}>
        <label className="search search--sm"><IconSearch width={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти товар" /></label>
        <button className="btn btn--accent btn--sm" onClick={() => navigate('/admin/products/new')}><IconPlus width={16} /><span>Добавить товар</span></button>
      </PageHead>

      {(noPrice > 0 || noSizes > 0) && (
        <div className="adm-alert">
          <b>Нужно заполнить:</b>
          {noPrice > 0 && <span> у {noPrice} товаров не указана цена;</span>}
          {noSizes > 0 && <span> у {noSizes} товаров не указаны размеры и остатки.</span>}
          <span> Пока их нет, покупатель видит «Цена уточняется» и кнопку WhatsApp вместо корзины.</span>
        </div>
      )}

      <div className="adm-table">
        <div className="adm-row adm-row--head">
          <span>Порядок</span><span>Товар</span><span>Цена</span><span>Наличие</span><span>Показ</span><span />
        </div>
        {list.map((p) => {
          const i = data.products.indexOf(p);
          const stock = p.variants.reduce((s, v) => s + v.sizes.reduce((a, x) => a + x.stock, 0), 0);
          return (
            <div key={p.id} className={`adm-row ${p.published ? '' : 'is-muted'}`}>
              <span className="adm-order">
                <button onClick={() => move(i, -1)} disabled={i === 0 || !!q} aria-label="Выше"><IconUp width={14} /></button>
                <button onClick={() => move(i, 1)} disabled={i === data.products.length - 1 || !!q} aria-label="Ниже"><IconDown width={14} /></button>
              </span>
              <Link to={`/admin/products/${p.id}`} className="adm-prod">
                {p.variants[0]?.images[0] ? <img src={p.variants[0].images[0]} alt="" /> : <span className="adm-prod__ph" />}
                <span><b>{p.name}</b><small>{cats[p.categoryId] || 'Без категории'} · {p.variants.map((v) => v.name).join(', ') || 'нет цветов'}</small></span>
              </Link>
              <span className="adm-price">
                {p.price == null ? <em className="warn">не указана</em> : p.salePrice != null ? <><s>{rub(p.price)}</s> {rub(p.salePrice)}</> : rub(p.price)}
              </span>
              <span>{p.variants.some((v) => v.sizes.length) ? `${stock} шт.` : <em className="warn">нет размеров</em>}</span>
              <span className="adm-flags">
                <button className={`chip ${p.published ? 'is-on' : ''}`} onClick={() => patch(p, { published: !p.published }, p.published ? 'Товар переведён в черновики' : 'Товар опубликован')}>{p.published ? 'На сайте' : 'Черновик'}</button>
                <button className={`chip ${p.featured ? 'is-on' : ''}`} onClick={() => patch(p, { featured: !p.featured }, p.featured ? 'Убран с главной' : 'Добавлен на главную')}>Главная</button>
                <button className={`chip ${p.isNew ? 'is-on' : ''}`} onClick={() => patch(p, { isNew: !p.isNew }, p.isNew ? 'Снята отметка «Новинка»' : 'Отмечен как новинка')}>Новинка</button>
              </span>
              <span className="adm-row__end">
                <Link to={`/admin/products/${p.id}`} className="btn btn--ghost btn--sm"><span>Изменить</span></Link>
                <button className="icon-btn icon-btn--danger" onClick={() => setDel(p)} aria-label={`Удалить ${p.name}`}><IconTrash width={16} /></button>
              </span>
            </div>
          );
        })}
        {!list.length && <p className="muted adm-empty">Товары не найдены.</p>}
      </div>
      <Confirm open={!!del} title="Удалить товар?" busy={busy}
        text={del ? `«${del.name}» будет удалён без возможности восстановления. Если нужно лишь убрать его с сайта — нажмите «Скрыть».` : ''}
        onConfirm={remove} onClose={() => setDel(null)} />
    </div>
  );
}

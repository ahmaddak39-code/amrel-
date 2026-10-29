import { useState } from 'react';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { Confirm, PageHead } from './ui.jsx';
import { IconPlus, IconTrash, IconUp, IconDown, IconCheck } from '../components/Icons.jsx';

function Row({ c, i, total, onSave, onDelete, onMove }) {
  const [name, setName] = useState(c.name);
  const [slug, setSlug] = useState(c.slug);
  const dirty = name !== c.name || slug !== c.slug;
  return (
    <div className="adm-row adm-row--cat">
      <span className="adm-order">
        <button onClick={() => onMove(i, -1)} disabled={i === 0} aria-label="Выше"><IconUp width={14} /></button>
        <button onClick={() => onMove(i, 1)} disabled={i === total - 1} aria-label="Ниже"><IconDown width={14} /></button>
      </span>
      <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Название" maxLength={40} />
      <span className="slug"><span>?category=</span><input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} aria-label="Адрес" maxLength={40} /></span>
      <span className="muted">{c.count} тов.</span>
      <span className="adm-row__end">
        <button className="btn btn--ghost btn--sm" disabled={!dirty} onClick={() => onSave(c, { name, slug })}><IconCheck width={14} /><span>Сохранить</span></button>
        <button className="icon-btn icon-btn--danger" onClick={() => onDelete(c)} aria-label={`Удалить ${c.name}`}><IconTrash width={16} /></button>
      </span>
    </div>
  );
}

export default function Categories({ data, onChanged, guard }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [del, setDel] = useState(null);
  const run = async (fn, msg) => {
    try { await fn(); toast.success(msg); await onChanged(); return true; }
    catch (e) { if (!guard(e)) toast.error(e.message); return false; }
  };
  const add = async (e) => {
    e.preventDefault();
    if (await run(() => api('/api/admin/categories', { method: 'POST', body: { name } }), 'Категория добавлена')) setName('');
  };
  const move = (i, d) => {
    const ids = data.categories.map((c) => c.id); const j = i + d;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => api('/api/admin/categories/reorder', { method: 'POST', body: { ids } }), 'Порядок сохранён');
  };
  return (
    <div className="adm-page">
      <PageHead title="Категории" sub="Пустые категории на сайте не показываются — появятся, как только в них будет товар" />
      <form className="adm-card adm-inline" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Новая категория, например «Лонгсливы»" maxLength={40} />
        <button className="btn btn--accent btn--sm" disabled={!name.trim()}><IconPlus width={14} /><span>Добавить</span></button>
      </form>
      <div className="adm-table">
        {data.categories.map((c, i) => (
          <Row key={c.id + c.name + c.slug} c={c} i={i} total={data.categories.length} onMove={move} onDelete={setDel}
            onSave={(cat, body) => run(() => api(`/api/admin/categories/${cat.id}`, { method: 'PUT', body }), 'Категория сохранена')} />
        ))}
      </div>
      <Confirm open={!!del} title="Удалить категорию?" text={del ? `Категория «${del.name}» будет удалена.` : ''}
        onConfirm={async () => { await run(() => api(`/api/admin/categories/${del.id}`, { method: 'DELETE' }), 'Категория удалена'); setDel(null); }}
        onClose={() => setDel(null)} />
    </div>
  );
}

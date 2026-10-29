import { useRef, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { uploadImage } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { IconPlus, IconTrash, IconUp, IconDown, IconImage } from '../components/Icons.jsx';

export function Confirm({ open, title, text, confirmLabel = 'Удалить', onConfirm, onClose, busy }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="muted">{text}</p>
      <div className="adm-actions">
        <button className="btn btn--ghost btn--sm" onClick={onClose}><span>Отмена</span></button>
        <button className="btn btn--danger btn--sm" onClick={onConfirm} disabled={busy}><span>{busy ? 'Удаляем…' : confirmLabel}</span></button>
      </div>
    </Modal>
  );
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track"><span className="toggle__thumb" /></span>
      <span className="toggle__text"><b>{label}</b>{hint && <small>{hint}</small>}</span>
    </label>
  );
}

/** Загрузка нескольких фото: прогресс, порядок, удаление. Первая — главная. */
export function ImageList({ value, onChange, labels = [], max = 20, hint, guard, onMain }) {
  const input = useRef(null);
  const toast = useToast();
  const [pending, setPending] = useState(0);

  const pick = async (files) => {
    const list = [...files].slice(0, max - value.length);
    if (!list.length) return;
    setPending((p) => p + list.length);
    let next = [...value];
    for (const file of list) {
      try { const url = await uploadImage(file); next = [...next, url]; onChange(next); }
      catch (e) { if (!guard?.(e)) toast.error(`${file.name}: ${e.message}`); }
      finally { setPending((p) => p - 1); }
    }
  };
  const move = (i, d) => { const a = [...value]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  const remove = (i) => onChange(value.filter((_, k) => k !== i));

  return (
    <div className="imglist">
      <div className="imglist__grid">
        {value.map((src, i) => (
          <figure key={src + i} className="imglist__item">
            <img src={src} alt="" />
            {labels[i] && <figcaption>{labels[i]}</figcaption>}
            {onMain && i > 0 && <button type="button" className="imglist__main" onClick={() => onChange([src, ...value.filter((_, k) => k !== i)])}>Сделать главным</button>}
            <div className="imglist__tools">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Сдвинуть влево"><IconUp width={14} style={{ transform: 'rotate(-90deg)' }} /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Сдвинуть вправо"><IconDown width={14} style={{ transform: 'rotate(-90deg)' }} /></button>
              <button type="button" onClick={() => remove(i)} aria-label="Удалить фото"><IconTrash width={14} /></button>
            </div>
          </figure>
        ))}
        {Array.from({ length: pending }).map((_, i) => <div key={`p${i}`} className="imglist__item is-pending"><span className="spinner" /></div>)}
        {value.length + pending < max && (
          <button type="button" className="imglist__add" onClick={() => input.current.click()}>
            <IconPlus /><span>Добавить фото</span>
          </button>
        )}
      </div>
      {hint && <p className="adm-hint"><IconImage width={14} /> {hint}</p>}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

export function SingleImage({ value, onChange, guard }) {
  return <ImageList value={value ? [value] : []} onChange={(a) => onChange(a[a.length - 1] || '')} max={1} guard={guard} />;
}

export function PageHead({ title, children, sub }) {
  return (
    <div className="adm-head">
      <div><h1 className="adm-head__title">{title}</h1>{sub && <p className="adm-head__sub">{sub}</p>}</div>
      <div className="adm-head__actions">{children}</div>
    </div>
  );
}

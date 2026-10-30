import { useEffect, useRef, useState } from 'react';
import { useCart } from '../lib/cart.jsx';
import { Link, useRouter } from '../lib/router.jsx';
import { rub, plural } from '../lib/format.js';
import { IconClose, IconMinus, IconPlus, IconTrash, IconArrow } from './Icons.jsx';
import { LogoMark } from './Logo.jsx';

function Qty({ value, max, onChange }) {
  const [pulse, setPulse] = useState(0);
  const change = (v) => { onChange(v); setPulse((p) => p + 1); };
  return (
    <div className="qty">
      <button onClick={() => change(value - 1)} disabled={value <= 1} aria-label="Уменьшить количество"><IconMinus width={14} height={14} /></button>
      <span key={pulse} className="qty__val">{value}</span>
      <button onClick={() => change(value + 1)} disabled={value >= max} aria-label="Увеличить количество"><IconPlus width={14} height={14} /></button>
    </div>
  );
}

function Line({ line, index, onRemove, onQty }) {
  const [leaving, setLeaving] = useState(false);
  const remove = () => { setLeaving(true); setTimeout(onRemove, 380); };
  return (
    <li className={`cline ${leaving ? 'is-leaving' : ''} ${line.problem ? 'has-problem' : ''}`} style={{ '--i': index }}>
      <div className="cline__inner">
        <Link to={line.product ? `/product/${line.product.slug}` : '/catalog'} className="cline__img">
          {line.image ? <img src={line.image} alt={line.name} loading="lazy" /> : <LogoMark />}
        </Link>
        <div className="cline__info">
          <div className="cline__top">
            <span className="cline__name">{line.name}</span>
            <button className="cline__rm" onClick={remove} aria-label={`Удалить ${line.name}`}><IconTrash width={16} height={16} /></button>
          </div>
          <span className="cline__meta">{[line.color, line.size].filter(Boolean).join(' · ')}</span>
          {line.problem && <span className="cline__problem">{line.problem}</span>}
          <div className="cline__bottom">
            <Qty value={line.qty} max={Math.max(line.maxQty, 1)} onChange={(v) => onQty(line.key, v)} />
            <span className="cline__sum">{line.price != null ? rub(line.sum) : '—'}</span>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function CartDrawer() {
  const { lines, open, setOpen, remove, setQty, total, count, hasProblems } = useCart();
  const { navigate, path } = useRouter();
  const panel = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle('drawer-lock', open);
    if (open) setTimeout(() => panel.current?.focus(), 50);
    return () => document.documentElement.classList.remove('drawer-lock');
  }, [open]);
  useEffect(() => { setOpen(false); }, [path, setOpen]);
  useEffect(() => {
    const on = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  }, [setOpen]);

  return (
    <div className={`drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="drawer__backdrop" onClick={() => setOpen(false)} />
      <aside className="drawer__panel" role="dialog" aria-modal="true" aria-label="Корзина" tabIndex={-1} ref={panel}>
        <div className="drawer__head">
          <h2 className="drawer__title">Корзина <sup>{count}</sup></h2>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Закрыть корзину"><IconClose /></button>
        </div>
        <span className="drawer__rule" />
        {lines.length === 0 ? (
          <div className="drawer__empty">
            <div className="drawer__empty-mark"><LogoMark /></div>
            <p className="drawer__empty-title">Корзина пока пуста</p>
            <p className="drawer__empty-text">Выберите футболку, цвет и размер — и она появится здесь.</p>
            <Link to="/catalog" className="btn btn--light" onClick={() => setOpen(false)}><span>Перейти в каталог</span><IconArrow width={18} /></Link>
          </div>
        ) : (
          <>
            <ul className="drawer__list">
              {lines.map((l, i) => (
                <Line key={l.key} line={l} index={i} onRemove={() => remove(l.key)} onQty={setQty} />
              ))}
            </ul>
            <div className="drawer__foot">
              <div className="drawer__total">
                <span>Итого · {count} {plural(count, ['товар', 'товара', 'товаров'])}</span>
                <strong>{rub(total)}</strong>
              </div>
              {hasProblems && <p className="drawer__warn">Некоторые позиции недоступны — удалите их, чтобы продолжить.</p>}
              <button className="btn btn--accent btn--block" disabled={hasProblems || !total}
                onClick={() => { setOpen(false); navigate('/checkout'); }}>
                <span>Оформить заказ</span><IconArrow width={18} />
              </button>
              <p className="drawer__note">Онлайн-оплата не подключена: после заявки менеджер подтвердит заказ и способ оплаты.</p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

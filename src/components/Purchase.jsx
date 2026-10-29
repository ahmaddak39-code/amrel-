import { useEffect, useMemo, useState } from 'react';
import { useCart } from '../lib/cart.jsx';
import { useToast } from '../lib/toast.jsx';
import { useStore } from '../lib/store.jsx';
import { rub, unitPrice, variantInStock, waLink, sortSizes } from '../lib/format.js';
import { IconArrow, IconCheck } from './Icons.jsx';

/** Состояние выбора цвета и размера. При смене цвета размер сохраняется, если он есть у нового цвета. */
export function useSelection(product, initialVariant) {
  const first = product.variants.find((v) => v.id === initialVariant) || product.variants.find(variantInStock) || product.variants[0];
  const [variantId, setVariantId] = useState(first?.id);
  const [size, setSize] = useState(null);
  useEffect(() => { setVariantId(first?.id); setSize(null); /* новый товар */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);
  const variant = product.variants.find((v) => v.id === variantId) || product.variants[0];
  const selectVariant = (id) => {
    const next = product.variants.find((v) => v.id === id);
    setVariantId(id);
    if (size && !next?.sizes.some((s) => s.size === size && s.stock > 0)) setSize(null);
  };
  return { variant, variantId, selectVariant, size, setSize };
}

export function Price({ product, className = '' }) {
  if (product.price == null) return <span className={`price price--ask ${className}`}>Цена уточняется</span>;
  return (
    <span className={`price ${className}`}>
      {product.salePrice != null && <s className="price__old">{rub(product.price)}</s>}
      <span className={product.salePrice != null ? 'price__sale' : ''}>{rub(unitPrice(product))}</span>
    </span>
  );
}

export function ColorPicker({ product, value, onChange, label = true }) {
  const current = product.variants.find((v) => v.id === value);
  return (
    <div className="picker">
      {label && <div className="picker__label"><span>Цвет</span><b key={current?.id} className="picker__value">{current?.name}</b></div>}
      <div className="swatches" role="radiogroup" aria-label="Цвет">
        {product.variants.map((v) => {
          const out = v.sizes.length > 0 && !variantInStock(v);
          return (
            <button key={v.id} role="radio" aria-checked={v.id === value} aria-label={`${v.name}${out ? ' — нет в наличии' : ''}`}
              className={`swatch ${v.id === value ? 'is-active' : ''} ${out ? 'is-out' : ''}`} onClick={() => onChange(v.id)} disabled={out}
              style={{ '--c': v.hex }} title={v.name}>
              <span className="swatch__dot" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SizePicker({ variant, value, onChange, onChart }) {
  const sizes = useMemo(() => {
    const order = sortSizes(variant.sizes.map((s) => s.size));
    return order.map((sz) => variant.sizes.find((s) => s.size === sz));
  }, [variant]);
  return (
    <div className="picker">
      <div className="picker__label">
        <span>Размер</span>
        {onChart && <button className="link-btn" onClick={onChart}>Таблица размеров</button>}
      </div>
      {sizes.length ? (
        <div className="sizes" role="radiogroup" aria-label="Размер">
          {sizes.map((s) => (
            <button key={s.size} role="radio" aria-checked={value === s.size} disabled={s.stock < 1}
              className={`size ${value === s.size ? 'is-active' : ''}`} onClick={() => onChange(s.size)}
              title={s.stock < 1 ? 'Нет в наличии' : s.stock <= 3 ? `Осталось ${s.stock} шт.` : undefined}>
              {s.size}
            </button>
          ))}
        </div>
      ) : <p className="picker__empty">Размеры для этого цвета уточняйте у менеджера</p>}
      {value && (() => { const s = sizes.find((x) => x.size === value); return s && s.stock <= 3 ? <p className="picker__hint">Осталось {s.stock} шт.</p> : null; })()}
    </div>
  );
}

/** Блок покупки: цвет, размер, кнопка «В корзину» или запрос в WhatsApp. */
export function PurchasePanel({ product, sel, onChart, onAdded, compact }) {
  const { add } = useCart();
  const toast = useToast();
  const { settings } = useStore();
  const [state, setState] = useState('idle'); // idle | added
  const [shake, setShake] = useState(0);
  const { variant, size } = sel;
  const priced = product.price != null;
  const hasSizes = variant.sizes.length > 0;
  const c = settings?.contacts || {};

  const onAdd = () => {
    if (!size) { setShake((s) => s + 1); return; }
    add({ productId: product.id, variantId: variant.id, size, qty: 1 });
    setState('added');
    toast.success(`${product.name} · ${variant.name} · ${size} — в корзине`, { image: variant.images[0] });
    onAdded?.();
    setTimeout(() => setState('idle'), 1600);
  };

  const askText = `Здравствуйте! Пишу с сайта AMREL. Интересует «${product.name}», цвет: ${variant.name}${size ? `, размер ${size}` : ''}. Подскажите цену и наличие.`;

  return (
    <div className={`purchase ${compact ? 'purchase--compact' : ''}`}>
      <ColorPicker product={product} value={variant.id} onChange={sel.selectVariant} />
      <div key={shake} className={shake ? 'shake' : ''}>
        <SizePicker variant={variant} value={size} onChange={sel.setSize} onChart={onChart} />
      </div>
      {priced && hasSizes ? (
        <button className={`btn btn--accent btn--block btn--add ${state === 'added' ? 'is-added' : ''}`} onClick={onAdd} disabled={!variantInStock(variant)}>
          <span className="btn__label">{!variantInStock(variant) ? 'Нет в наличии' : size ? 'Добавить в корзину' : 'Выберите размер'}</span>
          <span className="btn__done"><IconCheck width={18} /> Добавлено</span>
        </button>
      ) : null}
      {c.whatsapp && (
        <a className={`btn ${priced && hasSizes ? 'btn--ghost' : 'btn--accent'} btn--block`} href={waLink(c.whatsapp, askText)} target="_blank" rel="noopener noreferrer">
          <span>{priced && hasSizes ? 'Задать вопрос в WhatsApp' : 'Узнать цену и наличие в WhatsApp'}</span><IconArrow width={18} />
        </a>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Link } from '../lib/router.jsx';
import { Price } from './Purchase.jsx';
import { IconEye, IconFlip } from './Icons.jsx';
import { sortSizes, productInStock } from '../lib/format.js';

/** Карточка товара: при наведении — фото со спины, информация появляется по очереди, кнопка быстрого просмотра.
 *  На телефонах вместо наведения — кнопка поворота и всегда видимый быстрый просмотр. */
export default function ProductCard({ product, index = 0, onQuick, eager }) {
  const [vi, setVi] = useState(0);
  const [flip, setFlip] = useState(false);
  const v = product.variants[vi] || product.variants[0];
  const front = v?.images[0]; const back = v?.images[1];
  const sizes = sortSizes([...new Set(product.variants.flatMap((x) => x.sizes.filter((s) => s.stock > 0).map((s) => s.size)))]);
  const soldOut = product.variants.some((x) => x.sizes.length) && !productInStock(product);
  const href = `/product/${product.slug}${vi ? `?color=${v.id}` : ''}`;

  return (
    <article className={`pcard ${flip ? 'is-flipped' : ''}`} style={{ '--i': index }} data-flip={product.id}>
      <div className="pcard__frame">
      <Link to={href} className="pcard__media" aria-label={product.name}>
        <span className="pcard__imgs">
          {front && <img className="pcard__img pcard__img--front" src={front} alt={`${product.name} — ${v.name}`} loading={eager ? 'eager' : 'lazy'} decoding="async" />}
          {back && <img className="pcard__img pcard__img--back" src={back} alt="" loading="lazy" decoding="async" aria-hidden="true" />}
        </span>
        <span className="pcard__badges">
          {product.isNew && <span className="badge badge--new">New</span>}
          {product.salePrice != null && <span className="badge badge--sale">Sale</span>}
          {soldOut && <span className="badge">Нет в наличии</span>}
        </span>
        <span className="pcard__corner" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      </Link>
      {back && (
        <button className="pcard__flipbtn" onClick={() => setFlip((f) => !f)} aria-label={flip ? 'Показать перед' : 'Показать спину'}>
          <IconFlip width={18} height={18} />
        </button>
      )}
      {onQuick && (
        <button className="pcard__quick" onClick={() => onQuick(product, v.id)}>
          <IconEye width={16} height={16} /><span>Быстрый просмотр</span>
        </button>
      )}
      </div>
      <div className="pcard__body">
        <div className="pcard__row">
          <Link to={href} className="pcard__name">{product.name}</Link>
          <Price product={product} className="pcard__price" />
        </div>
        <div className="pcard__more">
          {product.variants.length > 0 && (
            <div className="pcard__colors" role="group" aria-label="Цвета">
              {product.variants.map((x, i) => (
                <button key={x.id} className={`dot ${i === vi ? 'is-active' : ''}`} style={{ '--c': x.hex }}
                  onMouseEnter={() => setVi(i)} onFocus={() => setVi(i)} onClick={() => setVi(i)} aria-label={x.name} title={x.name} />
              ))}
              <span className="pcard__colorname">{v?.name}</span>
            </div>
          )}
          <span className="pcard__sizes">{sizes.length ? sizes.join(' · ') : 'Размеры — по запросу'}</span>
        </div>
      </div>
    </article>
  );
}

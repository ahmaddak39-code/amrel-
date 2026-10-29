import { useState } from 'react';
import Modal from './Modal.jsx';
import { PurchasePanel, useSelection, Price } from './Purchase.jsx';
import SizeChart from './SizeChart.jsx';
import { Link } from '../lib/router.jsx';
import { useStore } from '../lib/store.jsx';
import { IconArrow } from './Icons.jsx';

function Inner({ product, variantId, onClose }) {
  const sel = useSelection(product, variantId);
  const [side, setSide] = useState(0);
  const [chart, setChart] = useState(false);
  const { settings } = useStore();
  const hasChart = settings?.sizeChart?.rows?.length > 0;
  const imgs = sel.variant.images;
  return (
    <div className="qv">
      <div className="qv__media" onMouseEnter={() => imgs[1] && setSide(1)} onMouseLeave={() => setSide(0)}>
        {imgs.slice(0, 2).map((src, i) => (
          <img key={src} src={src} alt={i ? '' : product.name} className={`qv__img ${side === i ? 'is-on' : ''}`} />
        ))}
        {imgs[1] && (
          <div className="qv__sides">
            <button className={side === 0 ? 'is-active' : ''} onClick={() => setSide(0)}>Перед</button>
            <button className={side === 1 ? 'is-active' : ''} onClick={() => setSide(1)}>Спина</button>
          </div>
        )}
      </div>
      <div className="qv__info">
        <h3 className="qv__name">{product.name}</h3>
        <Price product={product} className="qv__price" />
        <PurchasePanel product={product} sel={sel} compact onChart={hasChart ? () => setChart(true) : undefined} />
        <Link to={`/product/${product.slug}?color=${sel.variant.id}`} className="arrow-link" onClick={onClose}>
          Подробнее о товаре <IconArrow width={16} />
        </Link>
      </div>
      <SizeChart open={chart} onClose={() => setChart(false)} />
    </div>
  );
}

export default function QuickView({ state, onClose }) {
  return (
    <Modal open={!!state} onClose={onClose} title="Быстрый просмотр" wide>
      {state && <Inner key={state.product.id} product={state.product} variantId={state.variantId} onClose={onClose} />}
    </Modal>
  );
}

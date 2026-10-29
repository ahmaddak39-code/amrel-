import { useId, useState } from 'react';
import { IconPlus } from './Icons.jsx';

export default function Accordion({ items }) {
  const [open, setOpen] = useState(0);
  const uid = useId();
  return (
    <div className="acc">
      {items.filter((it) => it.content).map((it, i) => (
        <div key={it.title} className={`acc__item ${open === i ? 'is-open' : ''}`}>
          <button className="acc__head" aria-expanded={open === i} aria-controls={`${uid}-${i}`} onClick={() => setOpen(open === i ? -1 : i)}>
            <span>{it.title}</span><IconPlus className="acc__icon" width={18} height={18} />
          </button>
          <div className="acc__panel" id={`${uid}-${i}`} role="region">
            <div className="acc__inner"><div className="acc__content">{it.content}</div></div>
          </div>
        </div>
      ))}
    </div>
  );
}

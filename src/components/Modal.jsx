import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './Icons.jsx';

/** Модальное окно с анимацией появления/закрытия. */
export default function Modal({ open, onClose, title, children, className = '', wide }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (open) { setMounted(true); requestAnimationFrame(() => requestAnimationFrame(() => setShown(true))); }
    else if (mounted) { setShown(false); const t = setTimeout(() => setMounted(false), 450); return () => clearTimeout(t); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    document.documentElement.classList.add('modal-lock');
    setTimeout(() => box.current?.focus(), 60);
    const on = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', on);
    return () => { document.documentElement.classList.remove('modal-lock'); window.removeEventListener('keydown', on); prev?.focus?.(); };
  }, [open, onClose]);
  if (!mounted) return null;
  return createPortal(
    <div className={`modal ${shown ? 'is-open' : ''} ${wide ? 'modal--wide' : ''} ${className}`}>
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__box" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={box}>
        <div className="modal__head">
          {title && <h2 className="modal__title">{title}</h2>}
          <button className="icon-btn modal__close" onClick={onClose} aria-label="Закрыть"><IconClose /></button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

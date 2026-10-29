import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastCtx = createContext(null);
let uid = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 420);
  }, []);
  const show = useCallback((message, { type = 'info', image, action, duration = 3200 } = {}) => {
    const id = ++uid;
    setToasts((t) => [...t.slice(-3), { id, message, type, image, action }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);
  const api = useMemo(() => ({
    show, success: (m, o) => show(m, { ...o, type: 'success' }), error: (m, o) => show(m, { ...o, type: 'error', duration: 5000 }),
  }), [show]);
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type} ${t.leaving ? 'is-leaving' : ''}`}>
            {t.image && <img src={t.image} alt="" className="toast__img" />}
            <span className="toast__msg">{t.message}</span>
            {t.action && <button className="toast__action" onClick={() => { t.action.onClick(); dismiss(t.id); }}>{t.action.label}</button>}
            <span className="toast__bar" />
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useStore } from './store.jsx';
import { unitPrice } from './format.js';

const CartCtx = createContext(null);
const KEY = 'amrel_cart_v1';
const keyOf = (i) => `${i.productId}|${i.variantId}|${i.size}`;

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((i) => i && i.productId && i.variantId && i.size && i.qty > 0) : [];
  } catch { return []; }
}

export function CartProvider({ children }) {
  const { byId, catalog } = useStore();
  const [items, setItems] = useState(load);
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* приватный режим */ } }, [items]);
  // синхронизация между вкладками
  useEffect(() => {
    const on = (e) => { if (e.key === KEY) setItems(load()); };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);

  // Строки корзины всегда сверяются с актуальным каталогом: цена, наличие, фото
  const lines = useMemo(() => items.map((i) => {
    const p = byId(i.productId);
    const v = p?.variants.find((x) => x.id === i.variantId);
    const s = v?.sizes.find((x) => x.size === i.size);
    const price = unitPrice(p);
    let problem = '';
    if (!p) problem = catalog ? 'Товар больше не продаётся' : '';
    else if (!v || !s) problem = 'Вариант недоступен';
    else if (price == null) problem = 'Цена уточняется';
    else if (s.stock < 1) problem = 'Нет в наличии';
    else if (s.stock < i.qty) problem = `В наличии только ${s.stock} шт.`;
    return {
      ...i, key: keyOf(i), product: p, variant: v, price, maxQty: Math.min(20, s?.stock || 0),
      name: p?.name || 'Товар', image: v?.images[0], color: v?.name, problem, sum: price != null ? price * i.qty : 0,
    };
  }), [items, byId, catalog]);

  const add = useCallback((item) => {
    setItems((cur) => {
      const k = keyOf(item);
      const found = cur.find((x) => keyOf(x) === k);
      if (found) return cur.map((x) => (keyOf(x) === k ? { ...x, qty: Math.min(20, x.qty + (item.qty || 1)) } : x));
      return [...cur, { productId: item.productId, variantId: item.variantId, size: item.size, qty: item.qty || 1 }];
    });
    setBump((b) => b + 1);
  }, []);
  const setQty = useCallback((key, qty) => setItems((cur) => cur.map((x) => (keyOf(x) === key ? { ...x, qty: Math.max(1, Math.min(20, qty)) } : x))), []);
  const remove = useCallback((key) => setItems((cur) => cur.filter((x) => keyOf(x) !== key)), []);
  const clear = useCallback(() => setItems([]), []);

  const valid = lines.filter((l) => !l.problem);
  const value = useMemo(() => ({
    lines, items, add, setQty, remove, clear, open, setOpen, bump,
    count: items.reduce((s, i) => s + i.qty, 0),
    total: valid.reduce((s, l) => s + l.sum, 0),
    hasProblems: lines.some((l) => l.problem),
  }), [lines, items, add, setQty, remove, clear, open, bump, valid]);
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export const useCart = () => useContext(CartCtx);

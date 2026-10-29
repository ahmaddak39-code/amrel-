import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const StoreCtx = createContext(null);

function readInitial() {
  try { return JSON.parse(document.getElementById('__AMREL__').textContent); } catch { return {}; }
}

export function StoreProvider({ children }) {
  const init = useMemo(readInitial, []);
  const [catalog, setCatalog] = useState(init.catalog || null);
  const [settings, setSettings] = useState(init.settings || null);
  const [introDone, setIntroDone] = useState(false);

  const refresh = useCallback(async () => {
    const [c, s] = await Promise.all([api('/api/catalog'), api('/api/settings')]);
    setCatalog(c); setSettings(s);
  }, []);

  useEffect(() => { if (!catalog || !settings) refresh().catch(() => {}); }, [catalog, settings, refresh]);

  const value = useMemo(() => ({
    catalog, settings, refresh, introDone, setIntroDone,
    bySlug: (slug) => catalog?.products.find((p) => p.slug === slug),
    byId: (id) => catalog?.products.find((p) => p.id === id),
  }), [catalog, settings, refresh, introDone]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export const useStore = () => useContext(StoreCtx);

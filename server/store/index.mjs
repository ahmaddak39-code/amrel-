// Выбор хранилища: если заданы ключи Supabase — облако (для Vercel), иначе локальная база на компьютере.
let storePromise = null;

export function getStore() {
  if (!storePromise) {
    // Имена переменных, которые создаёт и ручная настройка, и интеграция Supabase в Vercel
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (url && key) {
      const opts = { url, key, bucket: process.env.SUPABASE_BUCKET || 'products' };
      storePromise = (async () => {
        // Есть SQL-таблицы — работаем с базой Postgres; нет — с JSON-файлами в закрытом хранилище Supabase
        try {
          const h = key.startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
          const r = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/categories?select=id&limit=1`, { headers: h });
          if (r.ok) return (await import('./supabase.mjs')).createSupabaseStore(opts);
        } catch { /* нет связи с таблицами — используем файлы */ }
        return (await import('./supabase-files.mjs')).createSupabaseFilesStore(opts);
      })();
      storePromise.catch(() => { storePromise = null; });
    } else {
      if (process.env.VERCEL) {
        return Promise.reject(Object.assign(new Error('Не заданы SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в настройках Vercel'), { config: true }));
      }
      storePromise = import('./local.mjs').then((m) => m.createLocalStore());
    }
  }
  return storePromise;
}

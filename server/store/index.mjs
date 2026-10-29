// Выбор хранилища: если заданы ключи Supabase — облако (для Vercel), иначе локальная база на компьютере.
let storePromise = null;

export function getStore() {
  if (!storePromise) {
    // Имена переменных, которые создаёт и ручная настройка, и интеграция Supabase в Vercel
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (url && key) {
      storePromise = import('./supabase.mjs').then((m) => m.createSupabaseStore({ url, key, bucket: process.env.SUPABASE_BUCKET || 'products' }));
    } else {
      if (process.env.VERCEL) {
        return Promise.reject(Object.assign(new Error('Не заданы SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в настройках Vercel'), { config: true }));
      }
      storePromise = import('./local.mjs').then((m) => m.createLocalStore());
    }
  }
  return storePromise;
}

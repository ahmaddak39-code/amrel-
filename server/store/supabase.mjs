// Облачное хранилище для публикации (Vercel): база Postgres и хранилище фото Supabase.
// Работает через официальные REST-API Supabase, без дополнительных библиотек.
// Ключ service_role используется ТОЛЬКО на сервере и никогда не попадает в браузер.
import { randomUUID, randomBytes } from 'node:crypto';
import { SEED_PRODUCTS, SEED_CATEGORIES, DEFAULT_SETTINGS } from '../seed.mjs';

export function createSupabaseStore({ url, key, bucket = 'products' }) {
  const base = url.replace(/\/+$/, '');
  // Старый ключ service_role — это JWT (начинается с eyJ) и передаётся ещё и как Bearer.
  // Новый секретный ключ (sb_secret_…) передаётся только в заголовке apikey.
  const headers = key.startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
  const enc = encodeURIComponent;

  async function rest(method, q, body, prefer) {
    const res = await fetch(`${base}/rest/v1/${q}`, {
      method,
      headers: { ...headers, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      const e = new Error(`База данных: ${res.status} ${text.slice(0, 300)}`);
      e.db = true; e.status = res.status;
      throw e;
    }
    return text ? JSON.parse(text) : null;
  }
  const get = (q) => rest('GET', q);

  const toProduct = (r) => r && ({
    id: r.id, slug: r.slug, name: r.name, description: r.description || '', details: r.details || '',
    categoryId: r.category_id, price: r.price, salePrice: r.sale_price, featured: !!r.featured, isNew: !!r.is_new,
    published: !!r.published, sort: r.sort, variants: r.variants || [], createdAt: r.created_at, updatedAt: r.updated_at,
  });
  const fromProduct = (p) => ({
    slug: p.slug, name: p.name, description: p.description || '', details: p.details || '', category_id: p.categoryId || null,
    price: p.price ?? null, sale_price: p.salePrice ?? null, featured: !!p.featured, is_new: !!p.isNew,
    published: p.published !== false, variants: p.variants || [], updated_at: new Date().toISOString(),
  });
  const toOrder = (r) => ({ id: r.id, number: r.number, status: r.status, customer: r.customer, items: r.items, total: r.total, createdAt: r.created_at, updatedAt: r.updated_at });

  // --- первичное наполнение пустой базы (безопасно при повторных вызовах) ---
  let seeded = null;
  async function ensureSeed() {
    if (seeded) return seeded;
    seeded = (async () => {
      let cats;
      try { cats = await get('categories?select=id&limit=1'); } catch (e) {
        if (/PGRST20[25]|does not exist|Could not find the table/i.test(e.message)) {
          throw Object.assign(new Error('Таблицы в Supabase ещё не созданы: выполните файл supabase/setup.sql в SQL Editor'), { config: true });
        }
        throw e;
      }
      await ensureBucket().catch(() => {});
      if (!cats.length) {
        await rest('POST', 'categories?on_conflict=id', SEED_CATEGORIES.map((c, i) => ({ ...c, sort: i })), 'resolution=ignore-duplicates');
        const t = Date.now();
        await rest('POST', 'products?on_conflict=id', SEED_PRODUCTS.map((p, i) => ({
          id: `seed-${p.slug}`, ...fromProduct(p), sort: i, created_at: new Date(t - i * 60000).toISOString(),
        })), 'resolution=ignore-duplicates');
      }
      await rest('POST', 'settings?on_conflict=key', Object.entries(DEFAULT_SETTINGS).map(([k, value]) => ({ key: k, value })), 'resolution=ignore-duplicates');
    })().catch((e) => { seeded = null; throw e; });
    return seeded;
  }

  const products = {
    async list({ publishedOnly = false } = {}) {
      await ensureSeed();
      return (await get(`products?select=*${publishedOnly ? '&published=eq.true' : ''}&order=sort.asc,created_at.desc`)).map(toProduct);
    },
    async get(id) { return toProduct((await get(`products?select=*&id=eq.${enc(id)}`))[0]); },
    async slugTaken(slug, exceptId = '') { return (await get(`products?select=id&slug=eq.${enc(slug)}&id=neq.${enc(exceptId || '-')}`)).length > 0; },
    async create(p) {
      const min = (await get('products?select=sort&order=sort.asc&limit=1'))[0]?.sort ?? 0;
      const row = (await rest('POST', 'products', { id: randomUUID(), ...fromProduct(p), sort: min - 1, created_at: new Date().toISOString() }, 'return=representation'))[0];
      return toProduct(row);
    },
    async update(id, p) { return toProduct((await rest('PATCH', `products?id=eq.${enc(id)}`, fromProduct(p), 'return=representation'))[0]); },
    async remove(id) { return (await rest('DELETE', `products?id=eq.${enc(id)}`, undefined, 'return=representation')).length > 0; },
    async reorder(ids) { await Promise.all(ids.map((id, i) => rest('PATCH', `products?id=eq.${enc(id)}`, { sort: i }))); },
  };

  const categories = {
    async list() {
      await ensureSeed();
      const [cats, prods] = await Promise.all([get('categories?select=*&order=sort.asc,name.asc'), get('products?select=category_id')]);
      return cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name, sort: c.sort, count: prods.filter((p) => p.category_id === c.id).length }));
    },
    async get(id) { return (await get(`categories?select=*&id=eq.${enc(id)}`))[0] || null; },
    async slugTaken(slug, exceptId = '') { return (await get(`categories?select=id&slug=eq.${enc(slug)}&id=neq.${enc(exceptId || '-')}`)).length > 0; },
    async create({ name, slug }) {
      const max = (await get('categories?select=sort&order=sort.desc&limit=1'))[0]?.sort ?? -1;
      const id = randomUUID();
      await rest('POST', 'categories', { id, name, slug, sort: max + 1 });
      return id;
    },
    async update(id, { name, slug }) { await rest('PATCH', `categories?id=eq.${enc(id)}`, { name, slug }); },
    async remove(id) { return (await rest('DELETE', `categories?id=eq.${enc(id)}`, undefined, 'return=representation')).length > 0; },
    async reorder(ids) { await Promise.all(ids.map((id, i) => rest('PATCH', `categories?id=eq.${enc(id)}`, { sort: i }))); },
  };

  const settings = {
    async all() {
      await ensureSeed();
      const out = { ...DEFAULT_SETTINGS };
      for (const r of await get('settings?select=key,value')) out[r.key] = r.value;
      return out;
    },
    async set(k, value) { await rest('POST', 'settings?on_conflict=key', { key: k, value }, 'resolution=merge-duplicates'); },
  };

  const orders = {
    async create({ customer, items, total }) {
      const now = new Date();
      const row = (await rest('POST', 'orders', {
        number: `tmp-${randomUUID()}`, status: 'new', customer, items, total, created_at: now.toISOString(), updated_at: now.toISOString(),
      }, 'return=representation'))[0];
      const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const number = `AM-${stamp}-${String(row.id).padStart(4, '0')}`;
      return toOrder((await rest('PATCH', `orders?id=eq.${row.id}`, { number }, 'return=representation'))[0]);
    },
    async list() { return (await get('orders?select=*&order=id.desc&limit=500')).map(toOrder); },
    async setStatus(id, status) {
      return (await rest('PATCH', `orders?id=eq.${enc(id)}`, { status, updated_at: new Date().toISOString() }, 'return=representation')).length > 0;
    },
    async countNew() { return (await get("orders?select=id&status=eq.new")).length; },
  };

  const sessions = {
    async create(tokenHash, ttl) {
      const t = Date.now();
      await rest('POST', 'sessions', { token_hash: tokenHash, created_at: t, expires_at: t + ttl });
      rest('DELETE', `sessions?expires_at=lt.${t}`).catch(() => {});
    },
    async valid(tokenHash) {
      const r = (await get(`sessions?select=expires_at&token_hash=eq.${enc(tokenHash)}`))[0];
      return !!r && Number(r.expires_at) > Date.now();
    },
    async remove(tokenHash) { await rest('DELETE', `sessions?token_hash=eq.${enc(tokenHash)}`); },
    async removeAll() { await rest('DELETE', 'sessions?created_at=gte.0'); },
  };

  const attempts = {
    async get(ip) { const r = (await get(`login_attempts?select=*&ip=eq.${enc(ip)}`))[0]; return r ? { first: Number(r.first), count: r.count } : null; },
    async set(ip, v) { await rest('POST', 'login_attempts?on_conflict=ip', { ip, first: v.first, count: v.count }, 'resolution=merge-duplicates'); },
    async clear(ip) { await rest('DELETE', `login_attempts?ip=eq.${enc(ip)}`); },
  };

  // Хранилище фото создаётся автоматически, если его ещё нет
  async function ensureBucket() {
    const r = await fetch(`${base}/storage/v1/bucket/${bucket}`, { headers });
    if (r.ok) return;
    await fetch(`${base}/storage/v1/bucket`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bucket, name: bucket, public: true, file_size_limit: 15728640, allowed_mime_types: ['image/webp', 'image/jpeg', 'image/png', 'image/avif'] }),
    });
  }

  const publicPrefix = `${base}/storage/v1/object/public/${bucket}/`;
  const media = {
    prefix: publicPrefix,
    async save(buf, ext, contentType) {
      const name = `${new Date().toISOString().slice(0, 7)}/${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${ext}`;
      const res = await fetch(`${base}/storage/v1/object/${bucket}/${name}`, {
        method: 'POST', headers: { ...headers, 'Content-Type': contentType, 'Cache-Control': '31536000', 'x-upsert': 'false' }, body: buf,
      });
      if (!res.ok) throw new Error(`Хранилище фото: ${res.status} ${(await res.text()).slice(0, 200)}`);
      return publicPrefix + name;
    },
  };

  async function health() {
    const out = { database: false, storage: false };
    try { await ensureSeed(); out.database = true; } catch (e) { out.databaseError = e.message; }
    try {
      const r = await fetch(`${base}/storage/v1/bucket/${bucket}`, { headers });
      out.storage = r.ok;
      if (r.ok) out.storagePublic = !!(await r.json()).public; else out.storageError = `${r.status} ${(await r.text()).slice(0, 200)}`;
    } catch (e) { out.storageError = e.message; }
    return out;
  }

  return { kind: 'supabase', products, categories, settings, orders, sessions, attempts, media, health };
}

// Хранилище AMREL на файлах Supabase Storage — работает без SQL-таблиц.
// Данные (товары, категории, тексты, заказы, сессии) — JSON-файлы в ЗАКРЫТОМ бакете amrel-data,
// фото — в публичном бакете products. Доступ только с серверным ключом.
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { SEED_PRODUCTS, SEED_CATEGORIES, DEFAULT_SETTINGS } from '../seed.mjs';

export function createSupabaseFilesStore({ url, key, bucket = 'products', dataBucket = 'amrel-data' }) {
  const base = url.replace(/\/+$/, '');
  const headers = key.startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');

  async function call(method, path, body, extra = {}) {
    const res = await fetch(`${base}/storage/v1/${path}`, {
      method, headers: { ...headers, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extra },
      body: body === undefined ? undefined : typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body),
    });
    return res;
  }
  async function ensureBucket(id, isPublic) {
    const r = await call('GET', `bucket/${id}`);
    if (r.ok) return;
    const c = await call('POST', 'bucket', { id, name: id, public: isPublic, ...(isPublic ? { file_size_limit: 15728640, allowed_mime_types: ['image/webp', 'image/jpeg', 'image/png', 'image/avif'] } : {}) });
    if (!c.ok && c.status !== 409) {
      const t = await c.text();
      if (!/already exists|Duplicate/i.test(t)) throw Object.assign(new Error(`Хранилище: ${c.status} ${t.slice(0, 200)}`), { db: true });
    }
  }
  async function readJson(path, fallback = null) {
    const r = await call('GET', `object/authenticated/${dataBucket}/${enc(path)}?t=${Date.now()}`, undefined, { 'Cache-Control': 'no-cache' });
    if (r.status === 404 || r.status === 400) return fallback;
    if (!r.ok) throw Object.assign(new Error(`Хранилище: ${r.status} ${(await r.text()).slice(0, 200)}`), { db: true });
    try { return JSON.parse(await r.text()); } catch { return fallback; }
  }
  async function writeJson(path, value) {
    const r = await call('POST', `object/${dataBucket}/${enc(path)}`, JSON.stringify(value), { 'Content-Type': 'application/json', 'x-upsert': 'true', 'Cache-Control': 'no-cache' });
    if (!r.ok) throw Object.assign(new Error(`Хранилище: ${r.status} ${(await r.text()).slice(0, 200)}`), { db: true });
  }
  async function removeFiles(paths) {
    if (!paths.length) return;
    await call('DELETE', `object/${dataBucket}`, { prefixes: paths });
  }
  async function list(prefix) {
    const r = await call('POST', `object/list/${dataBucket}`, { prefix, limit: 1000, offset: 0, sortBy: { column: 'name', order: 'desc' } });
    if (!r.ok) return [];
    return (await r.json()).filter((o) => o.name && !o.name.endsWith('/')).map((o) => o.name);
  }

  // --- первичная настройка: бакеты и стартовые данные ---
  let ready = null;
  function init() {
    if (!ready) {
      ready = (async () => {
        await ensureBucket(dataBucket, false);
        await ensureBucket(bucket, true);
        if (!(await readJson('db/categories.json'))) await writeJson('db/categories.json', SEED_CATEGORIES.map((c, i) => ({ ...c, sort: i })));
        if (!(await readJson('db/products.json'))) {
          const t = Date.now();
          await writeJson('db/products.json', SEED_PRODUCTS.map((p, i) => ({
            id: `seed-${p.slug}`, slug: p.slug, name: p.name, description: p.description || '', details: '', categoryId: p.categoryId,
            price: null, salePrice: null, featured: !!p.featured, isNew: false, published: true, sort: i, variants: p.variants,
            createdAt: new Date(t - i * 60000).toISOString(), updatedAt: new Date(t).toISOString(),
          })));
        }
      })().catch((e) => { ready = null; throw e; });
    }
    return ready;
  }
  const loadProducts = async () => { await init(); return (await readJson('db/products.json', [])) || []; };
  const saveProducts = (list) => writeJson('db/products.json', list);
  const loadCats = async () => { await init(); return (await readJson('db/categories.json', [])) || []; };
  const saveCats = (list) => writeJson('db/categories.json', list);
  const sortProducts = (a, b) => (a.sort - b.sort) || b.createdAt.localeCompare(a.createdAt);

  const products = {
    async list({ publishedOnly = false } = {}) {
      const all = (await loadProducts()).sort(sortProducts);
      return publishedOnly ? all.filter((p) => p.published) : all;
    },
    async get(id) { return (await loadProducts()).find((p) => p.id === id) || null; },
    async slugTaken(slug, exceptId = '') { return (await loadProducts()).some((p) => p.slug === slug && p.id !== exceptId); },
    async create(p) {
      const all = await loadProducts();
      const now = new Date().toISOString();
      const min = all.reduce((m, x) => Math.min(m, x.sort), 0);
      const item = { id: randomUUID(), ...p, sort: min - 1, createdAt: now, updatedAt: now };
      await saveProducts([...all, item]);
      return item;
    },
    async update(id, p) {
      const all = await loadProducts();
      let out = null;
      const next = all.map((x) => (x.id === id ? (out = { ...x, ...p, id, updatedAt: new Date().toISOString() }) : x));
      if (out) await saveProducts(next);
      return out;
    },
    async remove(id) {
      const all = await loadProducts();
      const next = all.filter((x) => x.id !== id);
      if (next.length === all.length) return false;
      await saveProducts(next);
      return true;
    },
    async reorder(ids) {
      const all = await loadProducts();
      await saveProducts(all.map((x) => (ids.includes(x.id) ? { ...x, sort: ids.indexOf(x.id) } : x)));
    },
  };

  const categories = {
    async list() {
      const [cats, prods] = await Promise.all([loadCats(), loadProducts()]);
      return cats.sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name))
        .map((c) => ({ id: c.id, slug: c.slug, name: c.name, sort: c.sort, count: prods.filter((p) => p.categoryId === c.id).length }));
    },
    async get(id) { return (await loadCats()).find((c) => c.id === id) || null; },
    async slugTaken(slug, exceptId = '') { return (await loadCats()).some((c) => c.slug === slug && c.id !== exceptId); },
    async create({ name, slug }) {
      const cats = await loadCats();
      const id = randomUUID();
      await saveCats([...cats, { id, name, slug, sort: cats.reduce((m, c) => Math.max(m, c.sort), -1) + 1 }]);
      return id;
    },
    async update(id, { name, slug }) { await saveCats((await loadCats()).map((c) => (c.id === id ? { ...c, name, slug } : c))); },
    async remove(id) {
      const cats = await loadCats();
      if (!cats.some((c) => c.id === id)) return false;
      await saveCats(cats.filter((c) => c.id !== id));
      const prods = await loadProducts();
      if (prods.some((p) => p.categoryId === id)) await saveProducts(prods.map((p) => (p.categoryId === id ? { ...p, categoryId: null } : p)));
      return true;
    },
    async reorder(ids) { await saveCats((await loadCats()).map((c) => (ids.includes(c.id) ? { ...c, sort: ids.indexOf(c.id) } : c))); },
  };

  const settings = {
    async all() { await init(); return { ...DEFAULT_SETTINGS, ...((await readJson('db/settings.json', {})) || {}) }; },
    async set(k, value) {
      await init();
      const cur = (await readJson('db/settings.json', {})) || {};
      cur[k] = value;
      await writeJson('db/settings.json', cur);
    },
  };

  // Заказы: каждый заказ — отдельный файл, поэтому одновременные заказы не мешают друг другу
  const orders = {
    async create({ customer, items, total }) {
      await init();
      const now = new Date();
      const id = now.getTime() * 1000 + Math.floor(Math.random() * 1000);
      const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const order = {
        id, number: `AM-${stamp}-${randomBytes(2).toString('hex').toUpperCase()}`, status: 'new', customer, items, total,
        createdAt: now.toISOString(), updatedAt: now.toISOString(),
      };
      await writeJson(`orders/${id}.json`, order);
      return order;
    },
    async list() {
      const names = (await list('orders')).slice(0, 500);
      const all = await Promise.all(names.map((n) => readJson(`orders/${n}`)));
      return all.filter(Boolean).sort((a, b) => b.id - a.id);
    },
    async setStatus(id, status) {
      const o = await readJson(`orders/${id}.json`);
      if (!o) return false;
      await writeJson(`orders/${id}.json`, { ...o, status, updatedAt: new Date().toISOString() });
      return true;
    },
    async countNew() { return (await orders.list()).filter((o) => o.status === 'new').length; },
  };

  const h = (s) => createHash('sha256').update(s).digest('hex').slice(0, 40);
  const sessions = {
    async create(tokenHash, ttl) { await writeJson(`sessions/${tokenHash}.json`, { expiresAt: Date.now() + ttl }); },
    async valid(tokenHash) {
      if (!/^[a-f0-9]{64}$/.test(tokenHash)) return false;
      const s = await readJson(`sessions/${tokenHash}.json`);
      return !!s && s.expiresAt > Date.now();
    },
    async remove(tokenHash) { await removeFiles([`sessions/${tokenHash}.json`]); },
    async removeAll() { await removeFiles((await list('sessions')).map((n) => `sessions/${n}`)); },
  };
  const attempts = {
    async get(ip) { return readJson(`attempts/${h(ip)}.json`); },
    async set(ip, v) { await writeJson(`attempts/${h(ip)}.json`, v); },
    async clear(ip) { await removeFiles([`attempts/${h(ip)}.json`]); },
  };

  const publicPrefix = `${base}/storage/v1/object/public/${bucket}/`;
  const media = {
    prefix: publicPrefix,
    async save(buf, ext, contentType) {
      await init();
      const name = `${new Date().toISOString().slice(0, 7)}/${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${ext}`;
      const r = await call('POST', `object/${bucket}/${name}`, buf, { 'Content-Type': contentType, 'Cache-Control': '31536000' });
      if (!r.ok) throw new Error(`Хранилище фото: ${r.status} ${(await r.text()).slice(0, 200)}`);
      return publicPrefix + name;
    },
  };

  async function health() {
    const out = { database: false, storage: false };
    try { await init(); await readJson('db/products.json'); out.database = true; out.storage = true; }
    catch (e) { out.databaseError = e.message; }
    return out;
  }

  return { kind: 'supabase', mode: 'files', products, categories, settings, orders, sessions, attempts, media, health };
}

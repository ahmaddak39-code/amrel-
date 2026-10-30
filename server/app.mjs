// Общая логика магазина: API, страницы, sitemap. Используется и локальным сервером (server/index.mjs),
// и функцией Vercel (api/index.mjs).
import { getStore } from './store/index.mjs';
import * as auth from './auth.mjs';
import * as V from './validate.mjs';
import { renderShell } from './shell.mjs';

export const ORDER_STATUSES = ['new', 'confirmed', 'shipped', 'completed', 'cancelled'];

let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* без sharp фото сохраняются как есть */ }

export function securityHeaders(store) {
  const img = ["'self'", 'data:', 'blob:'];
  if (store?.media?.prefix) img.push(new URL(store.media.prefix).origin);
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src ${img.join(' ')}; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
  };
}

let H = securityHeaders(null);
function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...H, ...headers });
  res.end(body);
}
const json = (res, status, data) => send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });

// Тело запроса: на Vercel оно может быть уже прочитано платформой (req.body)
function readBody(req, limit) {
  if (req.body !== undefined && req.body !== null) {
    const b = req.body;
    const buf = Buffer.isBuffer(b) ? b : typeof b === 'string' ? Buffer.from(b) : Buffer.from(JSON.stringify(b));
    if (buf.length > limit) return Promise.reject(Object.assign(new Error('too big'), { status: 413 }));
    return Promise.resolve(buf);
  }
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Слишком большой запрос'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const buf = await readBody(req, 1024 * 1024);
  try { return JSON.parse(buf.toString('utf8') || '{}'); } catch { throw new V.BadRequest('Некорректный JSON'); }
}
const clientIp = (req) => ((process.env.TRUST_PROXY === 'true' || process.env.VERCEL) && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim())
  || req.socket?.remoteAddress || 'unknown';

// Защита от CSRF: изменяющие запросы принимаем только со своего сайта
function sameOrigin(req) {
  if (req.headers['x-amrel'] !== '1') return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { return new URL(origin).host === host; } catch { return false; }
}

const publicSettings = (s) => Object.fromEntries(Object.entries(s).filter(([k]) => !k.startsWith('_')));
function publicProduct(p) {
  return {
    id: p.id, slug: p.slug, name: p.name, description: p.description, details: p.details, categoryId: p.categoryId,
    price: p.price, salePrice: p.salePrice, featured: p.featured, isNew: p.isNew, createdAt: p.createdAt, sort: p.sort, variants: p.variants,
  };
}
async function catalogData(store) {
  const [list, cats] = await Promise.all([store.products.list({ publishedOnly: true }), store.categories.list()]);
  const pub = list.map(publicProduct);
  return { products: pub, categories: cats.map(({ id, slug, name, sort }) => ({ id, slug, name, sort, count: pub.filter((p) => p.categoryId === id).length })) };
}

// ---------- изображения ----------
function sniffImage(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (/avif|avis/.test(brand)) return 'avif';
    if (/heic|heix|mif1|msf1|hevc/.test(brand)) return 'heic';
  }
  return null;
}
const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' };
async function saveUpload(store, buf, { share = false } = {}) {
  const kind = sniffImage(buf);
  if (!kind) throw new V.BadRequest('Поддерживаются фото JPG, PNG, WebP, AVIF или HEIC');
  // обложка для ссылки: мессенджеры надёжно показывают JPG 1200×630 до ~300 КБ
  if (share && sharp) {
    try {
      const out = await sharp(buf, { failOn: 'error' }).rotate().resize(1200, 630, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      return store.media.save(out, 'jpg', 'image/jpeg');
    } catch { throw new V.BadRequest('Файл повреждён или не является изображением'); }
  }
  if (share && kind !== 'jpg' && kind !== 'png') throw new V.BadRequest('Для обложки загрузите фото JPG или PNG');
  if (sharp && !share) {
    let out;
    try {
      out = await sharp(buf, { failOn: 'error' }).rotate().resize({ width: 1800, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    } catch {
      throw new V.BadRequest(kind === 'heic' ? 'Не удалось обработать HEIC. Сохраните фото как JPG и загрузите снова' : 'Файл повреждён или не является изображением');
    }
    return store.media.save(out, 'webp', 'image/webp');
  }
  if (kind === 'heic') throw new V.BadRequest('Формат HEIC не поддерживается — загрузите JPG');
  return store.media.save(buf, kind, TYPES[kind]);
}

const rate = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now(); const r = rate.get(key);
  if (!r || now - r.t > windowMs) { rate.set(key, { t: now, n: 1 }); return false; }
  return ++r.n > max;
}

// ---------- API ----------
async function handleApi(store, req, res, p) {
  const m = req.method;

  if (p === '/api/catalog' && m === 'GET') return json(res, 200, await catalogData(store));
  if (p === '/api/settings' && m === 'GET') return json(res, 200, publicSettings(await store.settings.all()));
  if (p === '/api/health' && m === 'GET') {
    const h = store.health ? await store.health() : { database: true, storage: true };
    const pw = h.database ? await auth.passwordConfigured(store) : false;
    return json(res, 200, { ok: h.database && h.storage && pw, database: h.database, photos: h.storage, adminPassword: pw,
      ...(h.database ? {} : { hint: h.databaseError }) });
  }

  if (p === '/api/orders' && m === 'POST') {
    if (!sameOrigin(req)) return json(res, 403, { error: 'Запрос отклонён' });
    if (rateLimited(`order:${clientIp(req)}`, 8, 60 * 60 * 1000)) return json(res, 429, { error: 'Слишком много заявок. Попробуйте позже или напишите нам в WhatsApp' });
    const body = await readJson(req);
    if (body.website) return json(res, 200, { ok: true, number: '—' }); // ловушка для ботов
    const reqData = V.orderRequest(body);
    const items = []; let total = 0;
    for (const it of reqData.items) {
      const prod = await store.products.get(it.productId);
      if (!prod || !prod.published) throw new V.BadRequest('Один из товаров больше недоступен — обновите корзину');
      const unit = prod.salePrice ?? prod.price;
      if (unit == null) throw new V.BadRequest(`Цена «${prod.name}» уточняется — оформите через WhatsApp`);
      const variant = prod.variants.find((v) => v.id === it.variantId);
      const size = variant?.sizes.find((s) => s.size === it.size);
      if (!variant || !size) throw new V.BadRequest(`«${prod.name}»: выбранный вариант недоступен`);
      if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 20) throw new V.BadRequest('Некорректное количество');
      if (size.stock < it.qty) throw new V.BadRequest(`«${prod.name}», ${variant.name}, ${size.size}: в наличии ${size.stock} шт.`);
      items.push({ productId: prod.id, slug: prod.slug, name: prod.name, variantId: variant.id, color: variant.name,
        size: size.size, qty: it.qty, price: unit, image: variant.images[0] || '' });
      total += unit * it.qty;
    }
    const order = await store.orders.create({ customer: reqData.customer, items, total });
    return json(res, 201, { ok: true, number: order.number, total, items });
  }

  // --- вход / выход ---
  if (p === '/api/admin/session' && m === 'GET') {
    const authenticated = await auth.isAdmin(store, req);
    return json(res, 200, { authenticated, configured: await auth.passwordConfigured(store), mustChange: authenticated ? await auth.mustChangePassword(store) : undefined });
  }
  if (p === '/api/admin/login' && m === 'POST') {
    if (!sameOrigin(req)) return json(res, 403, { error: 'Запрос отклонён' });
    const hash = await auth.currentHash(store);
    if (!hash) return json(res, 503, { error: 'Пароль администратора не настроен на сервере (ADMIN_PASSWORD_HASH)' });
    const ip = clientIp(req);
    const blocked = await auth.loginBlocked(store, ip);
    if (blocked) return json(res, 429, { error: `Слишком много попыток. Повторите через ${blocked} мин.` });
    const { password } = await readJson(req);
    await new Promise((r) => setTimeout(r, 300));
    if (!auth.verifyPassword(String(password || ''), hash)) {
      await auth.loginFailed(store, ip);
      return json(res, 401, { error: 'Неверный пароль' });
    }
    await auth.loginSucceeded(store, ip);
    await auth.createSession(store, req, res);
    return json(res, 200, { ok: true });
  }
  if (p === '/api/admin/logout' && m === 'POST') {
    await auth.destroySession(store, req, res);
    return json(res, 200, { ok: true });
  }

  // --- всё остальное в админке — только после входа ---
  if (p.startsWith('/api/admin/')) {
    if (!(await auth.isAdmin(store, req))) return json(res, 401, { error: 'Требуется вход в панель администратора' });
    if (m !== 'GET' && !sameOrigin(req)) return json(res, 403, { error: 'Запрос отклонён' });
    // пока действует начальный пароль, доступна только его смена
    if (p !== '/api/admin/password' && await auth.mustChangePassword(store)) {
      return json(res, 403, { error: 'Сначала смените начальный пароль', mustChange: true });
    }
    return handleAdmin(store, req, res, p, m);
  }
  return json(res, 404, { error: 'Не найдено' });
}

async function handleAdmin(store, req, res, p, m) {
  const [, , section, id] = p.split('/').filter(Boolean);
  const { products, categories, orders, settings } = store;
  const catIds = new Set((await categories.list()).map((c) => c.id));
  const categoryExists = (cid) => catIds.has(cid);

  if (section === 'overview' && m === 'GET') {
    const [list, cats, newOrders] = await Promise.all([products.list(), categories.list(), orders.countNew()]);
    return json(res, 200, { products: list, categories: cats, newOrders, storage: store.kind });
  }
  if (section === 'health' && m === 'GET') return json(res, 200, store.health ? await store.health() : { database: true, storage: true });

  if (section === 'password' && m === 'POST') {
    const { current, next } = await readJson(req);
    if (!auth.verifyPassword(String(current || ''), await auth.currentHash(store))) throw new V.BadRequest('Текущий пароль указан неверно');
    const n = String(next || '');
    if (n.length < 10) throw new V.BadRequest('Новый пароль — минимум 10 символов');
    if (!/[A-Za-zА-Яа-я]/.test(n) || !/\d/.test(n)) throw new V.BadRequest('Используйте в новом пароле и буквы, и цифры');
    if (n === String(current)) throw new V.BadRequest('Новый пароль совпадает с текущим');
    await auth.changePassword(store, n);
    await auth.createSession(store, req, res); // текущее устройство остаётся в панели
    return json(res, 200, { ok: true });
  }

  if (section === 'products') {
    if (!id && m === 'GET') return json(res, 200, await products.list());
    if (!id && m === 'POST') {
      const data = V.product(await readJson(req), { categoryExists });
      if (await products.slugTaken(data.slug)) throw new V.BadRequest('Товар с таким адресом уже есть — измените название или адрес');
      return json(res, 201, await products.create(data));
    }
    if (id === 'reorder' && m === 'POST') {
      const { ids } = await readJson(req);
      if (!Array.isArray(ids)) throw new V.BadRequest('Нужен список');
      await products.reorder(ids.map(String));
      return json(res, 200, { ok: true });
    }
    if (id && m === 'PUT') {
      if (!(await products.get(id))) return json(res, 404, { error: 'Товар не найден' });
      const data = V.product(await readJson(req), { categoryExists });
      if (await products.slugTaken(data.slug, id)) throw new V.BadRequest('Товар с таким адресом уже есть');
      return json(res, 200, await products.update(id, data));
    }
    if (id && m === 'DELETE') return (await products.remove(id)) ? json(res, 200, { ok: true }) : json(res, 404, { error: 'Товар не найден' });
  }

  if (section === 'categories') {
    if (!id && m === 'GET') return json(res, 200, await categories.list());
    if (id === 'reorder' && m === 'POST') {
      const { ids } = await readJson(req);
      await categories.reorder((ids || []).map(String));
      return json(res, 200, await categories.list());
    }
    if (!id && m === 'POST') {
      const b = await readJson(req);
      const name = V.str(b.name, { min: 1, max: 40, field: 'Название категории' });
      const slug = V.slugify(b.slug || name);
      if (!slug || await categories.slugTaken(slug)) throw new V.BadRequest('Категория с таким адресом уже существует');
      await categories.create({ name, slug });
      return json(res, 201, await categories.list());
    }
    if (id && m === 'PUT') {
      if (!(await categories.get(id))) return json(res, 404, { error: 'Категория не найдена' });
      const b = await readJson(req);
      const name = V.str(b.name, { min: 1, max: 40, field: 'Название категории' });
      const slug = V.slugify(b.slug || name);
      if (!slug || await categories.slugTaken(slug, id)) throw new V.BadRequest('Категория с таким адресом уже существует');
      await categories.update(id, { name, slug });
      return json(res, 200, await categories.list());
    }
    if (id && m === 'DELETE') {
      const cat = (await categories.list()).find((c) => c.id === id);
      if (!cat) return json(res, 404, { error: 'Категория не найдена' });
      if (cat.count > 0) throw new V.BadRequest(`В категории ${cat.count} товар(ов). Сначала перенесите их в другую категорию`);
      await categories.remove(id);
      return json(res, 200, await categories.list());
    }
  }

  if (section === 'settings') {
    if (m === 'GET') return json(res, 200, publicSettings(await settings.all()));
    if (m === 'PUT') {
      const b = await readJson(req);
      const clean = {};
      for (const [k, v] of Object.entries(b)) {
        if (!V.SETTINGS_KEYS.includes(k)) throw new V.BadRequest(`Неизвестный раздел: ${k}`);
        clean[k] = V.setting(k, v);
      }
      for (const [k, v] of Object.entries(clean)) await settings.set(k, v);
      return json(res, 200, publicSettings(await settings.all()));
    }
  }

  if (section === 'upload' && m === 'POST') {
    if (rateLimited(`upload:${clientIp(req)}`, 300, 60 * 60 * 1000)) return json(res, 429, { error: 'Слишком много загрузок подряд' });
    const buf = await readBody(req, 20 * 1024 * 1024);
    return json(res, 201, { url: await saveUpload(store, buf, { share: /[?&]share=1(&|$)/.test(req.url || '') }) });
  }

  if (section === 'orders') {
    if (!id && m === 'GET') return json(res, 200, await orders.list());
    if (id && m === 'PATCH') {
      const { status } = await readJson(req);
      if (!ORDER_STATUSES.includes(status)) throw new V.BadRequest('Неизвестный статус');
      return (await orders.setStatus(Number(id), status)) ? json(res, 200, { ok: true }) : json(res, 404, { error: 'Заказ не найден' });
    }
  }
  return json(res, 404, { error: 'Не найдено' });
}

/** Главный обработчик. pathname передаётся явно (на Vercel адрес приходит через переписывание). */
export async function handle(req, res, pathname) {
  try {
    const store = await getStore();
    H = securityHeaders(store);
    V.setMediaPrefix(store.media.prefix);
    if (pathname.startsWith('/api/')) return await handleApi(store, req, res, pathname);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed');

    const base = process.env.PUBLIC_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
    if (pathname === '/sitemap.xml') {
      const urls = ['/', '/catalog', ...(await store.products.list({ publishedOnly: true })).map((x) => `/product/${x.slug}`)];
      return send(res, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${base}${u}</loc></url>`).join('')}</urlset>`, { 'Content-Type': 'application/xml' });
    }
    if (pathname === '/robots.txt') {
      return send(res, 200, `User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /checkout\nSitemap: ${base}/sitemap.xml\n`, { 'Content-Type': 'text/plain' });
    }
    const [catalog, settings] = await Promise.all([catalogData(store), store.settings.all()]);
    const { html, status } = renderShell({ path: pathname, req, catalog, settings: publicSettings(settings) });
    return send(res, status, html, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  } catch (err) {
    if (err instanceof V.BadRequest) return json(res, 400, { error: err.message });
    if (err.status === 413) return json(res, 413, { error: 'Файл слишком большой. Попробуйте фото меньшего размера' });
    console.error(err);
    if (res.headersSent) return;
    if (!pathname.startsWith('/api/')) {
      // покупатель не видит технических ошибок — только аккуратную страницу бренда
      return send(res, 503, `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AMREL</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080808;color:#F5F5F5;font-family:Helvetica,Arial,sans-serif;text-align:center}
h1{font-size:clamp(48px,12vw,120px);letter-spacing:.2em;margin:0 0 12px;font-weight:900}i{display:block;width:120px;height:2px;margin:0 auto 18px;background:#FF6A00}p{color:#8d8d8d;margin:0}</style></head>
<body><div><h1>AMREL</h1><i></i><p>Сайт обновляется. Загляните через несколько минут.</p></div></body></html>`, { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '120' });
    }
    if (err.config) return json(res, 500, { error: err.message });
    if (err.db) return json(res, 500, { error: 'База данных недоступна. Проверьте настройки Supabase' });
    return json(res, 500, { error: 'Ошибка сервера. Попробуйте ещё раз' });
  }
}

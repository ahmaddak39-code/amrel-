// HTML-оболочка: мета-теги для SEO, данные для мгновенной первой отрисовки, ссылки на сборку.

// Имена собранных файлов (с хешем) записывает сборка: scripts/build.mjs → server/manifest.gen.mjs
import manifest from './manifest.gen.mjs';
const getManifest = () => manifest;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, (c) => (c === '\u2028' ? '\\u2028' : '\\u2029'));

// WhatsApp и часть мессенджеров не показывают WebP в превью — для своих фото есть JPG-копия
const ogImage = (src) => (/^\/img\/.+\.webp$/.test(src) ? src.replace(/\.webp$/, '.jpg') : src);
const abs = (base, src) => (/^https?:\/\//.test(src) ? src : base + src);

export function renderShell({ path, req, catalog, settings }) {
  const base = process.env.PUBLIC_URL || `${req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${req.headers.host}`;
  let title = 'AMREL — стиль без границ';
  let description = 'AMREL — streetwear-бренд. Оверсайз-футболки с авторскими принтами. Каталог, выбор цвета и размера, заказ онлайн.';
  const share = settings.share || {};
  let image = share.image || '/img/share.jpg';
  let shareCover = true; // обложка 1200×630
  let status = 200;
  let ld = { '@context': 'https://schema.org', '@type': 'ClothingStore', name: 'AMREL', url: base,
    address: settings.contacts?.address, telephone: settings.contacts?.phone };

  const pm = path.match(/^\/product\/([a-z0-9-]+)\/?$/);
  if (pm) {
    const prod = catalog.products.find((x) => x.slug === pm[1]);
    if (prod) {
      title = `${prod.name} — AMREL`;
      description = prod.description.slice(0, 160);
      const own = prod.variants[0]?.images[0];
      if (own) { image = own; shareCover = false; }
      const price = prod.salePrice ?? prod.price;
      ld = { '@context': 'https://schema.org', '@type': 'Product', name: prod.name, description: prod.description,
        brand: { '@type': 'Brand', name: 'AMREL' }, image: prod.variants.flatMap((v) => v.images.slice(0, 1)).map((i) => abs(base, i)) };
      if (price != null) {
        const inStock = prod.variants.some((v) => v.sizes.some((s) => s.stock > 0));
        ld.offers = { '@type': 'Offer', priceCurrency: 'RUB', price, availability: `https://schema.org/${inStock ? 'InStock' : 'OutOfStock'}`, url: `${base}/product/${prod.slug}` };
      }
    } else { status = 404; title = 'Товар не найден — AMREL'; }
  } else if (/^\/catalog\/?$/.test(path)) {
    title = 'Каталог — AMREL';
  } else if (path.startsWith('/admin')) {
    title = 'Панель администратора — AMREL';
  } else if (/^\/checkout/.test(path)) {
    title = 'Оформление заказа — AMREL';
  } else if (path === '/' || path === '') {
    if (share.title) title = share.title;
    if (share.description) description = share.description;
  } else {
    status = 404; title = 'Страница не найдена — AMREL';
  }

  const m = getManifest();
  const noindex = path.startsWith('/admin') || path.startsWith('/checkout');
  const data = path.startsWith('/admin') ? { settings: null, catalog: null } : { settings, catalog };
  const noscript = catalog.products.map((p) => `<li><a href="/product/${esc(p.slug)}">${esc(p.name)}</a></li>`).join('');

  const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="${esc(base + path)}">`}
<meta name="theme-color" content="#080808">
<meta property="og:type" content="${pm ? 'product' : 'website'}">
<meta property="og:site_name" content="AMREL">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(base + path)}">
<meta property="og:image" content="${esc(abs(base, ogImage(image)))}">
${shareCover ? '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n' : ''}<meta property="og:image:alt" content="AMREL">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/display-900.woff" as="font" type="font/woff" crossorigin>
<link rel="preload" href="/fonts/inter-400.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="${m.css}">
<script type="application/ld+json">${safeJson(ld)}</script>
</head>
<body>
<div id="root"></div>
<noscript><div class="noscript"><h1>AMREL</h1><p>Для работы магазина включите JavaScript.</p><ul>${noscript}</ul></div></noscript>
<script type="application/json" id="__AMREL__">${safeJson(data)}</script>
<script type="module" src="${m.js}"></script>
</body>
</html>`;
  return { html, status };
}

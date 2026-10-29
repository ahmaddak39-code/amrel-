// Проверка магазина через API. Запуск при работающем сервере:
//   TEST_PASSWORD=ваш_пароль npm test
// Создаёт тестовый товар и заказ, затем удаляет товар.
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PASS = process.env.TEST_PASSWORD;
let cookie = '';
let ok = 0; let failed = 0;
const check = (name, cond, extra = '') => { if (cond) { ok++; console.log(`  ✓ ${name}`); } else { failed++; console.log(`  ✗ ${name} ${extra}`); } };

async function req(path, { method = 'GET', body, raw, headers = {}, noCsrf } = {}) {
  const h = { ...headers };
  if (!noCsrf) h['X-Amrel'] = '1';
  if (cookie) h.Cookie = cookie;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers: h, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  let data = null; try { data = await res.json(); } catch { /* */ }
  return { status: res.status, data, headers: res.headers };
}

console.log('\nБезопасность (без входа):');
check('список товаров админки закрыт', (await req('/api/admin/products')).status === 401);
check('создание товара закрыто', (await req('/api/admin/products', { method: 'POST', body: { name: 'x' } })).status === 401);
check('загрузка фото закрыта', (await req('/api/admin/upload', { method: 'POST', raw: Buffer.from('x') })).status === 401);
check('изменение текстов закрыто', (await req('/api/admin/settings', { method: 'PUT', body: { slogan: 'hack' } })).status === 401);
check('заказы закрыты', (await req('/api/admin/orders')).status === 401);
check('поддельная cookie не проходит', (await req('/api/admin/products', { headers: { Cookie: 'amrel_admin=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } })).status === 401);
check('неверный пароль отклоняется', (await req('/api/admin/login', { method: 'POST', body: { password: 'wrong-password' } })).status === 401);
check('вход без защитного заголовка (CSRF) отклоняется', (await req('/api/admin/login', { method: 'POST', body: { password: PASS }, noCsrf: true })).status === 403);
const home = await fetch(BASE + '/');
const html = await home.text();
check('хеш пароля не попадает в страницу', !html.includes('scrypt:') && !/ADMIN_PASSWORD/.test(html));
check('заголовок CSP установлен', !!home.headers.get('content-security-policy'));

if (!PASS) { console.log('\nTEST_PASSWORD не задан — проверки после входа пропущены.'); process.exit(failed ? 1 : 0); }

console.log('\nВход и управление товарами:');
const login = await req('/api/admin/login', { method: 'POST', body: { password: PASS } });
check('вход с верным паролем', login.status === 200, JSON.stringify(login.data));
check('cookie сессии httpOnly + SameSite', /HttpOnly/i.test(login.headers.get('set-cookie') || '') && /SameSite=Strict/i.test(login.headers.get('set-cookie') || ''));
const ov = await req('/api/admin/overview');
check('панель видит товары', ov.status === 200 && ov.data.products.length > 0);

const png = Buffer.from('/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAKAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAB//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALQBMX3/2Q==', 'base64');
const up = await req('/api/admin/upload', { method: 'POST', raw: png, headers: { 'Content-Type': 'application/octet-stream' } });
check('загрузка фото', up.status === 201 && /^(\/media\/|https?:)/.test(up.data?.url || ''), JSON.stringify(up.data));
const bad = await req('/api/admin/upload', { method: 'POST', raw: Buffer.from('<script>alert(1)</script>'), headers: { 'Content-Type': 'application/octet-stream' } });
check('не-изображение отклоняется', bad.status === 400);
const media = await fetch(up.data.url.startsWith('http') ? up.data.url : BASE + up.data.url);
check('загруженное фото доступно по ссылке', media.status === 200);

const cat = ov.data.categories[0].id;
const created = await req('/api/admin/products', { method: 'POST', body: {
  name: 'Тестовая футболка', categoryId: cat, price: 3500, salePrice: 2990, published: true, isNew: true,
  variants: [{ name: 'Белый', hex: '#ffffff', images: [up.data.url], spin: [], sizes: [{ size: 'm', stock: 2 }, { size: 'L', stock: 0 }] }],
} });
check('создание товара', created.status === 201, JSON.stringify(created.data));
const p = created.data;
check('размер нормализован (M)', p.variants[0].sizes[0].size === 'M');
const badPrice = await req('/api/admin/products', { method: 'POST', body: { name: 'X', price: 100, salePrice: 200, variants: [] } });
check('скидочная цена выше обычной отклоняется', badPrice.status === 400);
const xss = await req('/api/admin/products', { method: 'POST', body: { name: 'X2', variants: [{ name: 'a', hex: '#000000', images: ['javascript:alert(1)'], sizes: [] }] } });
check('опасная ссылка на фото отклоняется', xss.status === 400);

const pub = await req('/api/catalog');
check('товар виден в публичном каталоге', pub.data.products.some((x) => x.id === p.id));

console.log('\nЗаказ (цены считает сервер):');
const order = await req('/api/orders', { method: 'POST', body: {
  customer: { name: 'Тест', phone: '+7 900 000-00-00', delivery: 'pickup' }, consent: true,
  items: [{ productId: p.id, variantId: p.variants[0].id, size: 'M', qty: 2, price: 1 }],
} });
check('заявка создана', order.status === 201, JSON.stringify(order.data));
check('итог рассчитан по цене со скидкой (2 × 2990 = 5980), подмена цены игнорируется', order.data?.total === 5980, String(order.data?.total));
const over = await req('/api/orders', { method: 'POST', body: {
  customer: { name: 'Тест', phone: '+7 900 000-00-00' }, consent: true,
  items: [{ productId: p.id, variantId: p.variants[0].id, size: 'M', qty: 3 }],
} });
check('больше, чем в наличии, — отказ', over.status === 400);
const out = await req('/api/orders', { method: 'POST', body: {
  customer: { name: 'Тест', phone: '+7 900 000-00-00' }, consent: true,
  items: [{ productId: p.id, variantId: p.variants[0].id, size: 'L', qty: 1 }],
} });
check('размер без остатка — отказ', out.status === 400);
const noConsent = await req('/api/orders', { method: 'POST', body: { customer: { name: 'Тест', phone: '+79000000000' }, items: [{ productId: p.id, variantId: p.variants[0].id, size: 'M', qty: 1 }] } });
check('без согласия на обработку данных — отказ', noConsent.status === 400);
const orders = await req('/api/admin/orders');
const mine = orders.data.find((o) => o.number === order.data.number);
check('заказ виден в админке', !!mine);
check('смена статуса заказа', (await req(`/api/admin/orders/${mine.id}`, { method: 'PATCH', body: { status: 'confirmed' } })).status === 200);

console.log('\nСмена пароля:');
const NEWPASS = 'Temp-Check-2026-xyz9';
check('слабый новый пароль отклоняется', (await req('/api/admin/password', { method: 'POST', body: { current: PASS, next: 'short' } })).status === 400);
check('неверный текущий пароль — отказ', (await req('/api/admin/password', { method: 'POST', body: { current: 'nope', next: NEWPASS } })).status === 400);
check('смена пароля', (await req('/api/admin/password', { method: 'POST', body: { current: PASS, next: NEWPASS } })).status === 200);
const keep = cookie;
cookie = '';
check('старый пароль больше не подходит', (await req('/api/admin/login', { method: 'POST', body: { password: PASS } })).status === 401);
check('новый пароль подходит', (await req('/api/admin/login', { method: 'POST', body: { password: NEWPASS } })).status === 200);
check('возврат исходного пароля (для повторных проверок)', (await req('/api/admin/password', { method: 'POST', body: { current: NEWPASS, next: PASS } })).status === 200);
check('секрет пароля не отдаётся в настройках', !JSON.stringify((await req('/api/settings')).data).includes('scrypt'));
void keep;

console.log('\nУдаление и выход:');
check('удаление товара', (await req(`/api/admin/products/${p.id}`, { method: 'DELETE' })).status === 200);
check('товар исчез из каталога', !(await req('/api/catalog')).data.products.some((x) => x.id === p.id));
await req('/api/admin/logout', { method: 'POST' });
check('после выхода доступ закрыт', (await req('/api/admin/products')).status === 401);

console.log(`\nИтого: ${ok} пройдено, ${failed} с ошибкой\n`);
process.exit(failed ? 1 : 0);

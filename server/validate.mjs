// Проверка и очистка данных, приходящих от клиента. Ничему из браузера не доверяем.
import { randomUUID } from 'node:crypto';

export class BadRequest extends Error {}
const fail = (m) => { throw new BadRequest(m); };

const TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
export function slugify(s) {
  return String(s || '').toLowerCase().split('').map((ch) => TR[ch] ?? ch).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export function str(v, { max = 500, min = 0, field = 'Поле' } = {}) {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  if (s.length < min) fail(min === 1 ? `${field}: заполните поле` : `${field}: слишком коротко`);
  if (s.length > max) fail(`${field}: не длиннее ${max} символов`);
  return s;
}

export function money(v, field) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 10_000_000) fail(`${field}: укажите целое число рублей`);
  return n;
}

const IMG_RE = /^\/(media|img)\/[A-Za-z0-9._/-]{1,200}$/;
let MEDIA_PREFIX = null; // адрес облачного хранилища фото (Supabase), если используется
export function setMediaPrefix(p) { MEDIA_PREFIX = p || null; }
export function imageUrl(v) {
  const s = String(v || '');
  const cloud = MEDIA_PREFIX && s.startsWith(MEDIA_PREFIX) && /^[A-Za-z0-9._/-]{1,200}$/.test(s.slice(MEDIA_PREFIX.length));
  if ((!IMG_RE.test(s) && !cloud) || s.includes('..')) fail('Некорректная ссылка на изображение');
  return s;
}
const imageList = (arr, max) => (Array.isArray(arr) ? arr : []).slice(0, max).map(imageUrl);

const linkRe = /^(\/[A-Za-z0-9._/?=&#-]*)?$/;

export function product(body, { categoryExists }) {
  const name = str(body.name, { min: 1, max: 120, field: 'Название' });
  const slug = slugify(body.slug || name);
  if (!slug) fail('Не удалось построить адрес страницы — задайте его вручную латиницей');
  const price = money(body.price, 'Цена');
  const salePrice = money(body.salePrice, 'Цена со скидкой');
  if (salePrice !== null && (price === null || salePrice >= price)) fail('Цена со скидкой должна быть меньше обычной цены');
  const categoryId = body.categoryId ? String(body.categoryId) : null;
  if (categoryId && !categoryExists(categoryId)) fail('Категория не найдена');
  const variantsIn = Array.isArray(body.variants) ? body.variants : [];
  if (variantsIn.length > 12) fail('Не больше 12 цветов у одного товара');
  const ids = new Set();
  const variants = variantsIn.map((vr, i) => {
    let id = slugify(vr.id || '') || randomUUID().slice(0, 8);
    while (ids.has(id)) id = `${id}-${i}`;
    ids.add(id);
    const hex = String(vr.hex || '');
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) fail(`Цвет «${vr.name || i + 1}»: укажите цвет в формате #RRGGBB`);
    const sizesIn = Array.isArray(vr.sizes) ? vr.sizes.slice(0, 15) : [];
    const seen = new Set();
    const sizes = sizesIn.map((s) => {
      const size = str(s.size, { min: 1, max: 10, field: 'Размер' }).toUpperCase();
      if (seen.has(size)) fail(`Размер ${size} указан дважды у цвета «${vr.name}»`);
      seen.add(size);
      const stock = Number(s.stock);
      if (!Number.isInteger(stock) || stock < 0 || stock > 99999) fail(`Остаток для ${size}: целое число от 0`);
      return { size, stock };
    });
    return {
      id,
      name: str(vr.name, { min: 1, max: 40, field: 'Название цвета' }),
      hex: hex.toUpperCase(),
      images: imageList(vr.images, 20),
      spin: imageList(vr.spin, 72),
      sizes,
    };
  });
  return {
    name, slug, price, salePrice, categoryId,
    description: str(body.description, { max: 4000, field: 'Описание' }),
    details: str(body.details, { max: 4000, field: 'Состав и уход' }),
    featured: !!body.featured, isNew: !!body.isNew, published: !!body.published,
    variants,
  };
}

// --- тексты и блоки сайта ---
const deepStr = (v, max) => str(v, { max });
export const SETTINGS_KEYS = ['hero', 'slogan', 'about', 'quote', 'marquee', 'lookbook', 'contacts', 'delivery', 'sizeChart'];

export function setting(key, v) {
  switch (key) {
    case 'hero': return {
      eyebrow: deepStr(v.eyebrow, 80), title: str(v.title, { min: 1, max: 80, field: 'Заголовок' }),
      subtitle: deepStr(v.subtitle, 200), image: imageUrl(v.image), imageSecondary: v.imageSecondary ? imageUrl(v.imageSecondary) : '',
      imageThird: v.imageThird ? imageUrl(v.imageThird) : '',
    };
    case 'slogan': return str(v, { min: 1, max: 60, field: 'Слоган' });
    case 'quote': return str(v, { min: 1, max: 120, field: 'Цитата' });
    case 'delivery': return str(v, { max: 1500, field: 'Доставка' });
    case 'marquee': return (Array.isArray(v) ? v : []).map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, 12).map((s) => str(s, { min: 1, max: 40, field: 'Бегущая строка' }));
    case 'about': return {
      title: str(v.title, { min: 1, max: 80, field: 'Заголовок' }), lead: deepStr(v.lead, 160), text: deepStr(v.text, 3000),
      image: v.image ? imageUrl(v.image) : '',
      pillars: (Array.isArray(v.pillars) ? v.pillars : []).slice(0, 4).map((p) => ({ title: deepStr(p.title, 40), text: deepStr(p.text, 200) })),
    };
    case 'lookbook': return (Array.isArray(v) ? v : []).slice(0, 10).map((l) => {
      const link = deepStr(l.link, 200);
      if (!linkRe.test(link)) fail('Ссылка в лукбуке должна начинаться с «/»');
      return { image: imageUrl(l.image), caption: deepStr(l.caption, 60), link };
    });
    case 'contacts': {
      const whatsapp = String(v.whatsapp || '').replace(/\D/g, '');
      if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) fail('WhatsApp: номер в международном формате, только цифры');
      const instagram = String(v.instagram || '').replace(/^@/, '').trim();
      if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) fail('Instagram: укажите имя аккаунта без ссылки');
      return {
        address: deepStr(v.address, 200), phone: deepStr(v.phone, 30), whatsapp, instagram,
        whatsappText: deepStr(v.whatsappText, 300), hours: deepStr(v.hours, 120),
      };
    }
    case 'sizeChart': {
      const columns = (Array.isArray(v.columns) ? v.columns : []).slice(0, 8).map((c) => deepStr(c, 30));
      const rows = (Array.isArray(v.rows) ? v.rows : []).slice(0, 20).map((r) => columns.map((_, i) => deepStr((r || [])[i], 30)));
      return { note: deepStr(v.note, 400), columns, rows };
    }
    default: fail('Неизвестный раздел настроек');
  }
}

// --- заявка на заказ ---
const PHONE_RE = /^[+\d][\d\s()-]{6,20}$/;
export function orderRequest(body) {
  const c = body.customer || {};
  const delivery = c.delivery === 'delivery' ? 'delivery' : 'pickup';
  const customer = {
    name: str(c.name, { min: 2, max: 80, field: 'Имя' }),
    phone: str(c.phone, { min: 7, max: 25, field: 'Телефон' }),
    delivery,
    city: str(c.city, { max: 80, field: 'Город' }),
    address: str(c.address, { max: 300, field: 'Адрес' }),
    comment: str(c.comment, { max: 1000, field: 'Комментарий' }),
  };
  if (!PHONE_RE.test(customer.phone)) fail('Телефон: проверьте номер');
  if (delivery === 'delivery' && (!customer.city || !customer.address)) fail('Для доставки укажите город и адрес');
  if (!body.consent) fail('Нужно согласие на обработку персональных данных');
  const items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
  if (!items.length) fail('Корзина пуста');
  return {
    customer,
    items: items.map((it) => ({
      productId: String(it.productId || ''), variantId: String(it.variantId || ''),
      size: String(it.size || '').toUpperCase(), qty: Number(it.qty),
    })),
  };
}

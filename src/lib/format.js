const nf = new Intl.NumberFormat('ru-RU');
export const rub = (n) => (n == null ? '' : `${nf.format(n)} ₽`);

export function plural(n, [one, few, many]) {
  const m10 = n % 10; const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export const waLink = (number, text) => `https://wa.me/${String(number || '').replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const telLink = (phone) => `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;
export const igLink = (name) => `https://www.instagram.com/${String(name || '').replace(/^@/, '')}/`;

export const unitPrice = (p) => (p ? p.salePrice ?? p.price : null);
export const variantInStock = (v) => v.sizes.some((s) => s.stock > 0);
export const productInStock = (p) => p.variants.some(variantInStock);
export const productPurchasable = (p) => unitPrice(p) != null && productInStock(p);

export const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL', 'ONE SIZE'];
export const sortSizes = (arr) => [...arr].sort((a, b) => {
  const ia = SIZE_ORDER.indexOf(a); const ib = SIZE_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b, 'ru', { numeric: true });
  if (ia === -1) return 1; if (ib === -1) return -1;
  return ia - ib;
});

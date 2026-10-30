export async function api(path, { method = 'GET', body, raw } = {}) {
  if (typeof __STATIC__ !== 'undefined' && __STATIC__) {
    throw new Error('Это онлайн-превью витрины: отправка заказов и панель администратора работают при запуске сервера (npm start)');
  }
  const headers = { 'X-Amrel': '1' };
  let payload;
  if (raw) { payload = raw; headers['Content-Type'] = 'application/octet-stream'; } // тип фото сервер определяет сам по содержимому
  else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  let res;
  try {
    res = await fetch(path, { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    throw new Error('Нет соединения с сервером. Проверьте интернет и попробуйте снова');
  }
  let data = null;
  try { data = await res.json(); } catch { /* пустой ответ */ }
  if (!res.ok) {
    const err = new Error(data?.error || `Ошибка ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Сжимает фото в браузере (с iPhone приходят файлы 3–12 МБ) и отправляет на сервер.
 *  Итоговый файл обычно 0,5–1,5 МБ — укладывается в лимиты облачного хостинга. */
async function decode(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* попробуем через <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
export async function uploadImage(file, { maxSide = 2000, cover = null } = {}) {
  let blob = null;
  try {
    const src = await decode(file);
    const w = src.width || src.naturalWidth; const h = src.height || src.naturalHeight;
    const canvas = document.createElement('canvas');
    if (cover) {
      // обложка для ссылки: обрезаем по центру до нужных пропорций
      const [cw, ch] = cover;
      const s = Math.max(cw / w, ch / h);
      canvas.width = cw; canvas.height = ch;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(src, (cw - w * s) / 2, (ch - h * s) / 2, w * s, h * s);
    } else {
      const scale = Math.min(1, maxSide / Math.max(w, h));
      canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
      canvas.getContext('2d').drawImage(src, 0, 0, canvas.width, canvas.height);
    }
    blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', cover ? 0.82 : 0.86));
  } catch { /* не удалось обработать в браузере */ }
  if (!blob) {
    if (file.size > 4 * 1024 * 1024) throw new Error('Не удалось сжать фото. Попробуйте другое фото или сделайте скриншот');
    blob = file;
  }
  const { url } = await api(cover ? '/api/admin/upload?share=1' : '/api/admin/upload', { method: 'POST', raw: blob });
  return url;
}

// Точка входа серверной функции Vercel (собирается scripts/build-vercel.mjs). Все адреса, кроме статических файлов,
// направляются сюда маршрутом из .vercel/output/config.json: /(.*) → /index?__p=$1
import { handle } from './app.mjs';

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://local');
  let pathname = url.pathname;
  if (url.searchParams.has('__p')) {
    pathname = `/${url.searchParams.get('__p') || ''}`.replace(/\/{2,}/g, '/');
    url.searchParams.delete('__p');
  }
  if (pathname === '/index') pathname = '/';
  return handle(req, res, pathname);
}

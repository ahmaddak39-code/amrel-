// Точка входа для Vercel. Все адреса, кроме статических файлов (картинки, шрифты, сборка),
// переписываются сюда правилом из vercel.json: /:path* → /api/index?__p=:path*
import { handle } from '../server/app.mjs';

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://local');
  let pathname = url.pathname;
  if (url.searchParams.has('__p')) {
    pathname = `/${url.searchParams.get('__p') || ''}`.replace(/\/{2,}/g, '/');
    url.searchParams.delete('__p');
  }
  if (pathname === '/api/index') pathname = '/';
  return handle(req, res, pathname);
}

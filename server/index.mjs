// AMREL — локальный сервер (MacBook или свой сервер). Запуск: npm start
import http from 'node:http';
import { existsSync, statSync, createReadStream } from 'node:fs';
import path from 'node:path';

if (existsSync('.env')) process.loadEnvFile('.env');

const { handle, securityHeaders } = await import('./app.mjs');
const { getStore } = await import('./store/index.mjs');
const auth = await import('./auth.mjs');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.resolve('public');
const MIME = {
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

function serveFile(req, res, file, cache) {
  let st;
  try { st = statSync(file); } catch { return false; }
  if (!st.isFile()) return false;
  const etag = `"${st.size.toString(16)}-${st.mtimeMs.toString(16)}"`;
  const h = { ...securityHeaders(null), ETag: etag, 'Cache-Control': cache };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, h); res.end(); return true; }
  res.writeHead(200, { ...h, 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size });
  if (req.method === 'HEAD') { res.end(); return true; }
  createReadStream(file).pipe(res);
  return true;
}
function safeJoin(root, rel) {
  try {
    const p = path.resolve(root, '.' + path.posix.normalize('/' + decodeURIComponent(rel)));
    return p.startsWith(root + path.sep) ? p : null;
  } catch { return null; }
}

const store = await getStore();

http.createServer(async (req, res) => {
  const p = new URL(req.url, 'http://local').pathname;
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (p.startsWith('/media/') && store.uploadDir) {
      const f = safeJoin(store.uploadDir, p.slice(7));
      if (f && serveFile(req, res, f, 'public, max-age=31536000, immutable')) return;
      res.writeHead(404); return res.end('Not found');
    }
    if (/^\/(assets|fonts|img)\//.test(p) || /^\/[\w.-]+\.(svg|ico|png|webmanifest)$/.test(p)) {
      const f = safeJoin(PUBLIC, p.slice(1));
      const cache = /^\/assets\/.*-[A-Z0-9]{8}\./.test(p) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
      if (f && serveFile(req, res, f, cache)) return;
      res.writeHead(404); return res.end('Not found');
    }
  }
  return handle(req, res, p);
}).listen(PORT, async () => {
  console.log(`\n  AMREL запущен: http://localhost:${PORT}`);
  console.log(`  Вход администратора: http://localhost:${PORT}/admin/login`);
  console.log(`  Хранилище: ${store.kind === 'supabase' ? 'Supabase (облако)' : 'локальная папка data/'}`);
  if (!(await auth.passwordConfigured(store))) console.log('  ⚠ Пароль администратора не настроен — выполните: npm run set-password');
});

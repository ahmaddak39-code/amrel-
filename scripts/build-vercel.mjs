// Сборка для Vercel в официальном формате Build Output API v3 (.vercel/output).
// Vercel публикует ровно этот результат: статические файлы + одна серверная функция + маршруты.
// Запускается автоматически на Vercel (npm run build); локально — при VERCEL=1 или флаге --force.
import * as esbuild from 'esbuild';
import { rmSync, mkdirSync, cpSync, writeFileSync } from 'node:fs';

if (!process.env.VERCEL && !process.argv.includes('--force')) process.exit(0);

const OUT = '.vercel/output';
const FN = `${OUT}/functions/index.func`;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/static`, { recursive: true });
mkdirSync(FN, { recursive: true });

// 1. Статика: собранный клиент, шрифты, фото товаров
cpSync('public', `${OUT}/static`, { recursive: true });

// 2. Серверная функция одним файлом
await esbuild.build({
  entryPoints: ['server/vercel-entry.mjs'],
  outfile: `${FN}/index.mjs`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['sharp', 'node:*'],
  // локальная база (SQLite) в облаке не нужна — заменяем её заглушкой
  plugins: [{
    name: 'no-local-store',
    setup(b) {
      b.onResolve({ filter: /\/local\.mjs$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: "export function createLocalStore() { throw new Error('Локальная база недоступна в облаке'); }", loader: 'js',
      }));
    },
  }],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'warning',
});
writeFileSync(`${FN}/.vc-config.json`, JSON.stringify({
  runtime: 'nodejs22.x',
  handler: 'index.mjs',
  launcherType: 'Nodejs',
  shouldAddHelpers: false,
  maxDuration: 30,
  memory: 1024,
}, null, 2));

// 3. Маршруты: сначала существующие файлы, всё остальное — в функцию магазина
writeFileSync(`${OUT}/config.json`, JSON.stringify({
  version: 3,
  routes: [
    { src: '^/(assets|fonts)/(.*)$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
    { src: '^/img/(.*)$', headers: { 'Cache-Control': 'public, max-age=86400' }, continue: true },
    { handle: 'filesystem' },
    { src: '^/(.*)$', dest: '/index?__p=$1' },
  ],
}, null, 2));

console.log('[vercel] .vercel/output готов: static + functions/index.func + config.json');

// Сборка онлайн-превью витрины: одна HTML-страница + папка img.
// Тот же код сайта, но адреса страниц хранятся в #имени, а данные каталога встроены в страницу.
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const OUT = 'preview';
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'amrel-preview-'));
const { products, categories, settings } = await import('../server/db.mjs');

const list = products.list({ publishedOnly: true }).map(({ published, updatedAt, ...p }) => p);
const cats = categories.list().map(({ id, slug, name, sort }) => ({ id, slug, name, sort, count: list.filter((p) => p.categoryId === id).length }));
const data = JSON.parse(JSON.stringify({ catalog: { products: list, categories: cats }, settings: settings.all() }).replaceAll('"/img/', '"img/'));

const res = await esbuild.build({
  entryPoints: ['src/main.jsx'], bundle: true, format: 'iife', minify: true, write: false, outdir: 'out',
  target: ['es2020', 'safari15'], jsx: 'automatic', external: ['/fonts/*', '/img/*'],
  define: { 'process.env.NODE_ENV': '"production"', __STATIC__: 'true' }, logLevel: 'warning',
});
let js = res.outputFiles.find((f) => f.path.endsWith('.js')).text;
let css = res.outputFiles.find((f) => f.path.endsWith('.css')).text;
css = css.replace(/url\(["']?\/fonts\/([\w-]+\.woff)["']?\)/g, (_, f) => `url(data:font/woff;base64,${readFileSync(`public/fonts/${f}`).toString('base64')})`);
css = css.replaceAll('url(/img/', 'url(img/');
js = js.replace(/<\/script/gi, '<\\/script');
const json = JSON.stringify(data).replace(/</g, '\\u003c');

const html = `<title>AMREL</title>
<meta name="description" content="AMREL — streetwear-бренд. Оверсайз-футболки с авторскими принтами.">
<style>:root{color-scheme:dark;background:#080808}body{background:#080808;color:#F5F5F5}${css.replace(/<\/style/gi, '<\\/style')}</style>
<div id="root"></div>
<script type="application/json" id="__AMREL__">${json}</script>
<script>${js}</script>
`;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, 'index.html'), html);
cpSync('public/img', path.join(OUT, 'img'), { recursive: true });
console.log(`[preview] ${OUT}/index.html — ${(html.length / 1024).toFixed(0)} КБ, товаров: ${list.length}`);

// Сборка клиентской части (React + CSS) в public/assets
import * as esbuild from 'esbuild';
import { rmSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const watch = process.argv.includes('--watch');
const outdir = 'public/assets';

const writeManifest = {
  name: 'manifest',
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length || !result.metafile) return;
      const outs = Object.entries(result.metafile.outputs);
      const js = outs.find(([, o]) => o.entryPoint === 'src/main.jsx');
      const css = js?.[1].cssBundle;
      const m = { js: '/' + js[0].replace(/^public\//, ''), css: '/' + (css || '').replace(/^public\//, '') };
      writeFileSync(path.join(outdir, 'manifest.json'), JSON.stringify(m));
      writeFileSync('server/manifest.gen.mjs', `// создаётся автоматически при сборке (npm run build)\nexport default ${JSON.stringify(m)};\n`);
      console.log(`[build] ${new Date().toLocaleTimeString()} — готово`);
    });
  },
};

const options = {
  entryPoints: ['src/main.jsx'],
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir,
  entryNames: '[name]-[hash]',
  chunkNames: 'chunks/[name]-[hash]',
  assetNames: 'files/[name]-[hash]',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  target: ['es2020', 'safari15'],
  jsx: 'automatic',
  loader: { '.woff': 'file', '.woff2': 'file' },
  external: ['/fonts/*', '/img/*'],
  metafile: true,
  define: { 'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production'), __STATIC__: 'false' },
  plugins: [writeManifest],
  logLevel: 'warning',
};

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });
if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}

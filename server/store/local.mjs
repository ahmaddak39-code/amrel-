// Локальное хранилище (для работы на компьютере): SQLite-файл data/amrel.db и папка data/uploads.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export async function createLocalStore() {
  const db = await import('../db.mjs');
  const wrap = (obj) => Object.fromEntries(Object.entries(obj).map(([k, fn]) => [k, async (...a) => fn.apply(obj, a)]));
  const attempts = new Map();
  return {
    kind: 'local',
    products: wrap(db.products),
    categories: wrap(db.categories),
    settings: wrap(db.settings),
    orders: wrap(db.orders),
    sessions: wrap(db.sessions),
    attempts: {
      async get(ip) { return attempts.get(ip) || null; },
      async set(ip, v) { attempts.set(ip, v); },
      async clear(ip) { attempts.delete(ip); },
    },
    media: {
      async save(buf, ext) {
        const name = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${ext}`;
        writeFileSync(path.join(db.UPLOAD_DIR, name), buf);
        return `/media/${name}`;
      },
      prefix: null,
    },
    uploadDir: db.UPLOAD_DIR,
  };
}

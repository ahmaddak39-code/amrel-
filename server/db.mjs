// Хранилище AMREL: SQLite (встроен в Node 22+). Файл базы — data/amrel.db
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { SEED_PRODUCTS, SEED_CATEGORIES, DEFAULT_SETTINGS } from './seed.mjs';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'amrel.db'));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  price INTEGER,
  sale_price INTEGER,
  featured INTEGER NOT NULL DEFAULT 0,
  is_new INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  variants TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  customer TEXT NOT NULL,
  items TEXT NOT NULL,
  total INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
`);

const now = () => new Date().toISOString();

// ---------- первичное наполнение (только если база пустая) ----------
function seed() {
  const c = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
  if (c === 0) {
    const ins = db.prepare('INSERT INTO categories (id, slug, name, sort) VALUES (?, ?, ?, ?)');
    SEED_CATEGORIES.forEach((cat, i) => ins.run(cat.id, cat.slug, cat.name, i));
  }
  const p = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (p === 0) {
    SEED_PRODUCTS.forEach((prod, i) => {
      const t = new Date(Date.now() - i * 60000).toISOString();
      insertProduct({ ...prod, sort: i }, t);
    });
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const has = db.prepare('SELECT 1 FROM settings WHERE key = ?').get(key);
    if (!has) db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
  }
}

// ---------- товары ----------
function rowToProduct(r) {
  if (!r) return null;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    details: r.details,
    categoryId: r.category_id,
    price: r.price,
    salePrice: r.sale_price,
    featured: !!r.featured,
    isNew: !!r.is_new,
    published: !!r.published,
    sort: r.sort,
    variants: JSON.parse(r.variants),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function insertProduct(p, t = now()) {
  const id = p.id || randomUUID();
  db.prepare(`INSERT INTO products (id, slug, name, description, details, category_id, price, sale_price,
     featured, is_new, published, sort, variants, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, p.slug, p.name, p.description || '', p.details || '', p.categoryId || null,
    p.price ?? null, p.salePrice ?? null, p.featured ? 1 : 0, p.isNew ? 1 : 0,
    p.published === false ? 0 : 1, p.sort ?? 0, JSON.stringify(p.variants || []), t, t,
  );
  return id;
}

export const products = {
  list({ publishedOnly = false } = {}) {
    const sql = `SELECT * FROM products ${publishedOnly ? 'WHERE published = 1' : ''} ORDER BY sort ASC, created_at DESC`;
    return db.prepare(sql).all().map(rowToProduct);
  },
  get(id) {
    return rowToProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
  },
  slugTaken(slug, exceptId = '') {
    return !!db.prepare('SELECT 1 FROM products WHERE slug = ? AND id != ?').get(slug, exceptId);
  },
  create(p) {
    const maxSort = db.prepare('SELECT COALESCE(MIN(sort), 0) AS s FROM products').get().s;
    const id = insertProduct({ ...p, sort: maxSort - 1 });
    return this.get(id);
  },
  update(id, p) {
    db.prepare(`UPDATE products SET slug=?, name=?, description=?, details=?, category_id=?, price=?, sale_price=?,
      featured=?, is_new=?, published=?, variants=?, updated_at=? WHERE id=?`).run(
      p.slug, p.name, p.description || '', p.details || '', p.categoryId || null, p.price ?? null,
      p.salePrice ?? null, p.featured ? 1 : 0, p.isNew ? 1 : 0, p.published ? 1 : 0,
      JSON.stringify(p.variants || []), now(), id,
    );
    return this.get(id);
  },
  remove(id) {
    return db.prepare('DELETE FROM products WHERE id = ?').run(id).changes > 0;
  },
  reorder(ids) {
    const st = db.prepare('UPDATE products SET sort = ? WHERE id = ?');
    ids.forEach((id, i) => st.run(i, id));
  },
};

// ---------- категории ----------
export const categories = {
  list() {
    return db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS count
      FROM categories c ORDER BY sort ASC, name ASC`).all()
      .map((r) => ({ id: r.id, slug: r.slug, name: r.name, sort: r.sort, count: r.count }));
  },
  get(id) {
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  },
  slugTaken(slug, exceptId = '') {
    return !!db.prepare('SELECT 1 FROM categories WHERE slug = ? AND id != ?').get(slug, exceptId);
  },
  create({ name, slug }) {
    const id = randomUUID();
    const s = db.prepare('SELECT COALESCE(MAX(sort), -1) AS s FROM categories').get().s + 1;
    db.prepare('INSERT INTO categories (id, slug, name, sort) VALUES (?, ?, ?, ?)').run(id, slug, name, s);
    return id;
  },
  update(id, { name, slug }) {
    db.prepare('UPDATE categories SET name = ?, slug = ? WHERE id = ?').run(name, slug, id);
  },
  remove(id) {
    return db.prepare('DELETE FROM categories WHERE id = ?').run(id).changes > 0;
  },
  reorder(ids) {
    const st = db.prepare('UPDATE categories SET sort = ? WHERE id = ?');
    ids.forEach((id, i) => st.run(i, id));
  },
};

// ---------- настройки и тексты сайта ----------
export const settings = {
  all() {
    const out = { ...DEFAULT_SETTINGS };
    for (const r of db.prepare('SELECT key, value FROM settings').all()) out[r.key] = JSON.parse(r.value);
    return out;
  },
  set(key, value) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, JSON.stringify(value));
  },
};

// ---------- заказы ----------
export const ORDER_STATUSES = ['new', 'confirmed', 'shipped', 'completed', 'cancelled'];

function rowToOrder(r) {
  return {
    id: r.id, number: r.number, status: r.status, customer: JSON.parse(r.customer),
    items: JSON.parse(r.items), total: r.total, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export const orders = {
  create({ customer, items, total }) {
    const t = now();
    const d = new Date();
    const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const info = db.prepare(`INSERT INTO orders (number, status, customer, items, total, created_at, updated_at)
      VALUES (?, 'new', ?, ?, ?, ?, ?)`).run(`tmp-${randomUUID()}`, JSON.stringify(customer), JSON.stringify(items), total, t, t);
    const number = `AM-${stamp}-${String(info.lastInsertRowid).padStart(4, '0')}`;
    db.prepare('UPDATE orders SET number = ? WHERE id = ?').run(number, info.lastInsertRowid);
    return rowToOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid));
  },
  list() {
    return db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 500').all().map(rowToOrder);
  },
  setStatus(id, status) {
    return db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), id).changes > 0;
  },
  countNew() {
    return db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'new'").get().n;
  },
};

// ---------- сессии администратора ----------
export const sessions = {
  create(tokenHash, ttlMs) {
    const t = Date.now();
    db.prepare('INSERT INTO sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)').run(tokenHash, t, t + ttlMs);
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(t);
  },
  valid(tokenHash) {
    const r = db.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').get(tokenHash);
    return !!r && r.expires_at > Date.now();
  },
  remove(tokenHash) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  },
  removeAll() {
    db.prepare('DELETE FROM sessions').run();
  },
};

seed();
export default db;

// Серверная авторизация администратора.
// Начальный пароль — scrypt-хеш в секрете ADMIN_PASSWORD_HASH (переменная окружения / настройки Vercel).
// После смены пароля в панели новый хеш хранится в базе и имеет приоритет. Сам пароль нигде не хранится.
// Сессия — случайный токен в httpOnly-cookie; в базе лежит только его SHA-256.
import { randomBytes, createHash } from 'node:crypto';
import { verifyPassword, hashPassword } from './auth-hash.mjs';
import { INITIAL_ADMIN_HASH } from './initial-admin.mjs';

export { verifyPassword, hashPassword };
export const COOKIE = 'amrel_admin';
const TTL = 1000 * 60 * 60 * 24 * 7; // 7 дней
const PW_KEY = '_admin_password_hash';
const sha = (t) => createHash('sha256').update(t).digest('hex');

export async function currentHash(store) {
  const s = await store.settings.all();
  return s[PW_KEY] || process.env.ADMIN_PASSWORD_HASH || INITIAL_ADMIN_HASH || '';
}
/** true — действует одноразовый начальный пароль, и его нужно сменить, прежде чем работать в панели */
export async function mustChangePassword(store) {
  const s = await store.settings.all();
  return !s[PW_KEY] && !process.env.ADMIN_PASSWORD_HASH && !!INITIAL_ADMIN_HASH;
}
export async function passwordConfigured(store) { return !!(await currentHash(store)); }

export async function changePassword(store, next) {
  await store.settings.set(PW_KEY, hashPassword(next));
  await store.sessions.removeAll(); // все старые входы (на других устройствах) завершаются
}

export function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function isSecure(req) {
  if (process.env.COOKIE_SECURE === 'false') return false;
  return req.headers['x-forwarded-proto'] === 'https' || !!req.socket?.encrypted || process.env.COOKIE_SECURE === 'true' || !!process.env.VERCEL;
}

export async function createSession(store, req, res) {
  const token = randomBytes(32).toString('base64url');
  await store.sessions.create(sha(token), TTL);
  const attrs = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${TTL / 1000}`];
  if (isSecure(req)) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export async function destroySession(store, req, res) {
  const token = parseCookies(req)[COOKIE];
  if (token) await store.sessions.remove(sha(token));
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

export async function isAdmin(store, req) {
  const token = parseCookies(req)[COOKIE];
  return !!token && token.length > 20 && store.sessions.valid(sha(token));
}

// --- ограничение попыток входа: 5 ошибок за 15 минут → блокировка IP на 15 минут (хранится в базе) ---
const WINDOW = 15 * 60 * 1000;
export async function loginBlocked(store, ip) {
  const a = await store.attempts.get(ip);
  if (!a) return 0;
  if (Date.now() - a.first > WINDOW) { await store.attempts.clear(ip); return 0; }
  return a.count >= 5 ? Math.ceil((a.first + WINDOW - Date.now()) / 60000) : 0;
}
export async function loginFailed(store, ip) {
  const a = await store.attempts.get(ip);
  if (!a || Date.now() - a.first > WINDOW) await store.attempts.set(ip, { first: Date.now(), count: 1 });
  else await store.attempts.set(ip, { first: a.first, count: a.count + 1 });
}
export const loginSucceeded = (store, ip) => store.attempts.clear(ip);

import { neon } from '@neondatabase/serverless';
import { scrypt, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';

const scryptP = promisify(scrypt);

/* ---------- database (Neon Postgres) ---------- */
let client;
export const sql = (...args) => {
  if (!client) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error('DATABASE_URL belum diset');
    client = neon(url);
  }
  return client(...args);
};

// Tabel dibuat otomatis saat pertama kali dipakai.
let schema;
export function ready() {
  schema ??= (async () => {
    await sql`create table if not exists users (
      id serial primary key,
      username text unique not null,
      pw_hash text not null,
      created_at timestamptz not null default now()
    )`;
    await sql`create table if not exists courses (
      id uuid primary key default gen_random_uuid(),
      user_id integer not null references users(id) on delete cascade,
      name text not null,
      cols jsonb not null default '["UTS","UAS"]',
      students jsonb not null default '[]',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`;
    await sql`create index if not exists courses_user_idx on courses (user_id)`;
  })().catch((e) => { schema = undefined; throw e; });
  return schema;
}

/* ---------- password: scrypt + salt acak ---------- */
export async function hashPw(pw) {
  const salt = randomBytes(16);
  const key = await scryptP(pw, salt, 64);
  return salt.toString('hex') + ':' + key.toString('hex');
}
export async function checkPw(pw, stored) {
  const [s, k] = String(stored).split(':');
  if (!s || !k) return false;
  const key = await scryptP(pw, Buffer.from(s, 'hex'), 64);
  const want = Buffer.from(k, 'hex');
  return key.length === want.length && timingSafeEqual(key, want);
}

/* ---------- sesi: cookie HttpOnly bertanda tangan HMAC ---------- */
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET belum diset (minimal 16 karakter)');
  return s;
};
const sign = (p) => createHmac('sha256', secret()).update(p).digest('base64url');
const COOKIE = 'HttpOnly; Secure; SameSite=Lax; Path=/';

export function startSession(res, id, name) {
  const p = Buffer.from(JSON.stringify({ i: id, n: name, e: Date.now() + 7 * 864e5 })).toString('base64url');
  res.setHeader('Set-Cookie', `sid=${p}.${sign(p)}; ${COOKIE}; Max-Age=604800`);
}
export const endSession = (res) => res.setHeader('Set-Cookie', `sid=; ${COOKIE}; Max-Age=0`);

export function readSession(req) {
  const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const [p, sig] = m[1].split('.');
  if (!p || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(p));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(p, 'base64url').toString());
    return d.e > Date.now() ? d : null;
  } catch { return null; }
}

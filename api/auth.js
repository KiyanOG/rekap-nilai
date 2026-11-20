import { sql, ready, hashPw, checkPw, startSession, endSession, readSession } from '../lib/server.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const s = readSession(req);
      return s ? res.status(200).json({ user: s.n }) : res.status(401).json({ error: 'Belum login' });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method tidak didukung' });

    const { action, username, password } = req.body || {};
    if (action === 'logout') { endSession(res); return res.status(200).json({ ok: true }); }

    const u = String(username || '').trim().toLowerCase();
    const p = String(password || '');
    if (!/^[a-z0-9_.-]{3,32}$/.test(u))
      return res.status(400).json({ error: 'Username 3–32 karakter: huruf, angka, titik, strip, atau garis bawah.' });
    if (p.length < 6 || p.length > 200)
      return res.status(400).json({ error: 'Password minimal 6 karakter.' });

    await ready();

    if (action === 'register') {
      try {
        const rows = await sql`insert into users (username, pw_hash) values (${u}, ${await hashPw(p)}) returning id`;
        startSession(res, rows[0].id, u);
        return res.status(201).json({ user: u });
      } catch (e) {
        if (e && e.code === '23505') return res.status(409).json({ error: 'Username sudah dipakai.' });
        throw e;
      }
    }
    if (action === 'login') {
      const rows = await sql`select id, pw_hash from users where username = ${u}`;
      const ok = rows.length ? await checkPw(p, rows[0].pw_hash) : (await hashPw(p), false); // waktu proses dibuat mirip
      if (!ok) return res.status(401).json({ error: 'Username atau password salah.' });
      startSession(res, rows[0].id, u);
      return res.status(200).json({ user: u });
    }
    return res.status(400).json({ error: 'Aksi tidak dikenal.' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Terjadi kesalahan di server.' });
  }
}

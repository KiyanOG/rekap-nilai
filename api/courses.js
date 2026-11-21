import { sql, ready, readSession } from '../lib/server.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v, n) => String(v ?? '').slice(0, n);

// Bersihkan & batasi data dari klien
function clean(b) {
  const name = str(b.name, 100).trim();
  if (!name) throw new Error('Nama matkul wajib diisi.');
  const cols = [...new Set((Array.isArray(b.cols) ? b.cols : []).map((c) => str(c, 40).trim()).filter(Boolean))].slice(0, 30);
  const students = (Array.isArray(b.rows) ? b.rows : []).slice(0, 2000).map((r) => {
    const s = {};
    for (const c of cols) { const v = str(r?.s?.[c], 20); if (v !== '') s[c] = v; }
    return { name: str(r?.name, 100), nim: str(r?.nim, 30), s };
  });
  const weights = {};
  for (const c of cols) {
    const v = parseFloat(String(b.weights?.[c] ?? '').replace(',', '.'));
    if (Number.isFinite(v) && v > 0) weights[c] = Math.min(v, 100);
  }
  return { name, cols, students, weights };
}

export default async function handler(req, res) {
  try {
    const sess = readSession(req);
    if (!sess) return res.status(401).json({ error: 'Belum login' });
    await ready();

    const uid = sess.i;
    const id = req.query?.id;
    if (id && !UUID.test(id)) return res.status(400).json({ error: 'ID tidak valid.' });

    if (req.method === 'GET') {
      const courses = await sql`select id, name, cols, weights, students as rows from courses where user_id = ${uid} order by created_at`;
      return res.status(200).json({ courses });
    }
    if (req.method === 'POST') {
      const name = str(req.body?.name, 100).trim();
      if (!name) return res.status(400).json({ error: 'Nama matkul wajib diisi.' });
      const r = await sql`insert into courses (user_id, name) values (${uid}, ${name}) returning id, name, cols, weights, students as rows`;
      return res.status(201).json({ course: r[0] });
    }
    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ error: 'ID wajib diisi.' });
      let d; try { d = clean(req.body || {}); } catch (e) { return res.status(400).json({ error: e.message }); }
      const r = await sql`update courses set name = ${d.name}, cols = ${JSON.stringify(d.cols)}::jsonb,
        students = ${JSON.stringify(d.students)}::jsonb, weights = ${JSON.stringify(d.weights)}::jsonb, updated_at = now()
        where id = ${id} and user_id = ${uid} returning id`;
      return r.length ? res.status(200).json({ ok: true }) : res.status(404).json({ error: 'Matkul tidak ditemukan.' });
    }
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'ID wajib diisi.' });
      await sql`delete from courses where id = ${id} and user_id = ${uid}`;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method tidak didukung' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Terjadi kesalahan di server.' });
  }
}
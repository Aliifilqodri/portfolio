const crypto = require('crypto');
const { db } = require('./_db');
const { ok } = require('./_auth');

const DIM = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const clean = (s, n) => String(s || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);

function norm(x) {
  const m = Number(x && x.m), d = Number(x && x.d), y = x && x.y ? Number(x.y) : null;
  const nama = clean(x && x.nama, 80);
  if (!nama || !(m >= 1 && m <= 12) || !(d >= 1 && d <= DIM[m - 1])) return null;
  if (y && !(y >= 1900 && y <= new Date().getFullYear())) return null;
  return { id: clean(x.id, 40) || crypto.randomBytes(6).toString('hex'), nama, d, m, y, catatan: clean(x.catatan, 300) };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!ok(req)) return res.status(401).json({ error: 'Belum login' });
  try {
    const col = (await db()).collection('settings');
    if (req.method === 'GET') {
      const d = await col.findOne({ _id: 'ultah' });
      return res.json({ items: d && Array.isArray(d.items) ? d.items : [] });
    }
    if (req.method === 'PUT') {
      const list = req.body && Array.isArray(req.body.items) ? req.body.items : null;
      if (!list || list.length > 500) return res.status(400).json({ error: 'Data tidak valid' });
      const items = list.map(norm).filter(Boolean);
      await col.updateOne({ _id: 'ultah' }, { $set: { items } }, { upsert: true });
      return res.json({ ok: true, items });
    }
    res.status(405).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};
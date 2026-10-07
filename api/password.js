const { db } = require('./_db');
const { ok, check, hash } = require('./_auth');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  if (!ok(req)) return res.status(401).json({ error: 'Belum login' });
  try {
    const { lama, baru } = req.body || {};
    if (!(await check(String(lama || '')))) return res.status(403).json({ error: 'Password lama salah' });
    if (typeof baru !== 'string' || baru.length < 10) return res.status(400).json({ error: 'Password baru minimal 10 karakter' });
    await (await db()).collection('settings').updateOne({ _id: 'admin' }, { $set: hash(baru) }, { upsert: true });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};

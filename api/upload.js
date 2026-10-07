const { db } = require('./_db');
const { ok } = require('./_auth');
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  if (!ok(req)) return res.status(401).json({ error: 'Belum login' });
  try {
    const { type, data } = req.body || {};
    if (!TYPES.includes(type) || typeof data !== 'string') return res.status(400).json({ error: 'File tidak didukung' });
    const buf = Buffer.from(data, 'base64');
    if (!buf.length || buf.length > 3.2 * 1024 * 1024) return res.status(413).json({ error: 'Maksimal 3 MB' });
    const r = await (await db()).collection('files').insertOne({ type, data: buf, size: buf.length, at: new Date() });
    res.json({ url: '/api/file?id=' + r.insertedId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal upload' });
  }
};

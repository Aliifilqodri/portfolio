const { db } = require('./_db');

const MAX_TESTIMONI = 100;
const JEDA_MS = 10000; // jeda minimal antar kiriman (seluruh pengunjung)
const bersih = (s, n) => String(s || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);

// Publik: pengunjung menulis testimoni, langsung tampil di website.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    if (b.website) return res.json({ ok: true }); // jebakan bot
    const nama = bersih(b.nama, 80), jabatan = bersih(b.jabatan, 80), isi = bersih(b.isi, 600);
    if (nama.length < 2 || isi.length < 10) {
      return res.status(400).json({ error: 'Isi nama dan testimoni (minimal 10 huruf).' });
    }
    const d = await db();
    const gate = await d.collection('settings').findOne({ _id: 'tamu' });
    if (gate && Date.now() - (gate.at || 0) < JEDA_MS) {
      return res.status(429).json({ error: 'Terlalu cepat, coba lagi beberapa detik lagi.' });
    }
    const site = await d.collection('site').findOne({ _id: 'site' });
    const data = site && site.data && typeof site.data === 'object' ? site.data : {};
    const list = Array.isArray(data.testimoni) ? data.testimoni : [];
    if (list.length >= MAX_TESTIMONI) return res.status(429).json({ error: 'Kolom testimoni sudah penuh.' });
    if (list.some(x => x && x.nama === nama && x.isi === isi)) return res.json({ ok: true });
    data.testimoni = [{ isi, nama, jabatan }].concat(list); // terbaru di paling atas
    await d.collection('settings').updateOne({ _id: 'tamu' }, { $set: { at: Date.now() } }, { upsert: true });
    await d.collection('site').updateOne({ _id: 'site' }, { $set: { data, updated: new Date() } }, { upsert: true });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};
const { db } = require('./_db');
const { ok } = require('./_auth');
const ver = d => (d && d.updated ? new Date(d.updated).getTime() : 0);
module.exports = async (req, res) => {
  try {
    const col = (await db()).collection('site');
    if (req.method === 'GET') {
      const d = await col.findOne({ _id: 'site' });
      res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=30');
      return res.json(d ? Object.assign({}, d.data, { _v: ver(d) }) : {});
    }
    if (req.method === 'PUT') {
      if (!ok(req)) return res.status(401).json({ error: 'Belum login' });
      const b = req.body;
      if (!b || typeof b !== 'object' || Array.isArray(b)) return res.status(400).json({ error: 'Data tidak valid' });
      const v = b._v;
      delete b._v;
      if (JSON.stringify(b).length > 500000) return res.status(413).json({ error: 'Data terlalu besar' });
      const cur = await col.findOne({ _id: 'site' });
      // Pengaman: kalau data berubah sejak halaman ini dimuat (misalnya ada testimoni baru), jangan menimpa.
      if (cur && v !== undefined && Number(v) !== ver(cur)) {
        return res.status(409).json({ error: 'Ada data baru (misalnya testimoni masuk). Halaman dimuat ulang, silakan ulangi perubahanmu.' });
      }
      const now = new Date();
      await col.updateOne({ _id: 'site' }, { $set: { data: b, updated: now } }, { upsert: true });
      return res.json({ ok: true, v: now.getTime() });
    }
    res.status(405).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};
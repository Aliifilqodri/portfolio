const { db } = require('./_db');
const { ok } = require('./_auth');
module.exports = async (req, res) => {
  try {
    const col = (await db()).collection('site');
    if (req.method === 'GET') {
      const d = await col.findOne({ _id: 'site' });
      res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=30');
      return res.json(d ? d.data : {});
    }
    if (req.method === 'PUT') {
      if (!ok(req)) return res.status(401).json({ error: 'Belum login' });
      const b = req.body;
      if (!b || typeof b !== 'object' || Array.isArray(b)) return res.status(400).json({ error: 'Data tidak valid' });
      if (JSON.stringify(b).length > 500000) return res.status(413).json({ error: 'Data terlalu besar' });
      await col.updateOne({ _id: 'site' }, { $set: { data: b, updated: new Date() } }, { upsert: true });
      return res.json({ ok: true });
    }
    res.status(405).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};

const { db, ObjectId } = require('./_db');
module.exports = async (req, res) => {
  try {
    const id = String(req.query.id || '');
    if (!/^[a-f0-9]{24}$/.test(id)) return res.status(400).end();
    const f = await (await db()).collection('files').findOne({ _id: new ObjectId(id) });
    if (!f) return res.status(404).end();
    res.setHeader('Content-Type', f.type);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(Buffer.from(f.data.buffer));
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
};

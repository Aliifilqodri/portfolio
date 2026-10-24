const crypto = require('crypto');
const { db } = require('./_db');
const { ok } = require('./_auth');

const clean = (s, n) => String(s || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);
const isDate = s => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
};
const rid = x => clean(x, 40) || crypto.randomBytes(6).toString('hex');

function todo(x) {
  const t = clean(x && x.t, 120);
  if (!t) return null;
  return { id: rid(x.id), t, tgl: isDate(x.tgl) ? x.tgl : '', done: isDate(x.done) ? x.done : '' };
}
function event(x) {
  const judul = clean(x && x.judul, 100);
  if (!judul || !isDate(x.tgl)) return null;
  return { id: rid(x.id), judul, tgl: x.tgl, jam: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(x.jam || '')) ? x.jam : '', catatan: clean(x.catatan, 300) };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!ok(req)) return res.status(401).json({ error: 'Belum login' });
  try {
    const col = (await db()).collection('settings');
    if (req.method === 'GET') {
      const d = await col.findOne({ _id: 'planner' });
      return res.json({ todos: d && Array.isArray(d.todos) ? d.todos : [], events: d && Array.isArray(d.events) ? d.events : [] });
    }
    if (req.method === 'PUT') {
      const b = req.body || {};
      if (!Array.isArray(b.todos) || !Array.isArray(b.events) || b.todos.length > 300 || b.events.length > 500) return res.status(400).json({ error: 'Data tidak valid' });
      const todos = b.todos.map(todo).filter(Boolean), events = b.events.map(event).filter(Boolean);
      await col.updateOne({ _id: 'planner' }, { $set: { todos, events } }, { upsert: true });
      return res.json({ ok: true, todos, events });
    }
    res.status(405).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};
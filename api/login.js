const { make, ok, check } = require('./_auth');
const flags = 'Path=/; HttpOnly; SameSite=Strict' + (process.env.VERCEL ? '; Secure' : '');
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') return res.json({ ok: ok(req) });
    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', 'adm=; ' + flags + '; Max-Age=0');
      return res.json({ ok: true });
    }
    if (req.method !== 'POST') return res.status(405).end();
    const pw = String((req.body && req.body.password) || '');
    if (!(await check(pw))) {
      return setTimeout(() => res.status(401).json({ error: 'Password salah' }), 700);
    }
    res.setHeader('Set-Cookie', 'adm=' + make() + '; ' + flags + '; Max-Age=604800');
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error. Cek MONGODB_URI dan SESSION_SECRET di Vercel.' });
  }
};

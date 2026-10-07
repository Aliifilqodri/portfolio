const c = require('crypto');
const { db } = require('./_db');
const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
const sign = e => c.createHmac('sha256', secret()).update(String(e)).digest('hex');
function make() { const e = Date.now() + 7 * 864e5; return e + '.' + sign(e); }
function ok(req) {
  const m = /(?:^|; )adm=([^;]+)/.exec(req.headers.cookie || '');
  if (!m || !secret()) return false;
  const [e, s] = m[1].split('.');
  if (!e || !s || +e < Date.now()) return false;
  const a = Buffer.from(s), b = Buffer.from(sign(e));
  return a.length === b.length && c.timingSafeEqual(a, b);
}
function same(a, b) {
  const x = c.createHash('sha256').update(a).digest(), y = c.createHash('sha256').update(b).digest();
  return c.timingSafeEqual(x, y);
}
function hash(pw) {
  const salt = c.randomBytes(16).toString('hex');
  return { salt, hash: c.scryptSync(pw, salt, 64).toString('hex') };
}
async function check(pw) {
  const d = await (await db()).collection('settings').findOne({ _id: 'admin' });
  if (d) {
    const a = Buffer.from(d.hash, 'hex'), b = c.scryptSync(pw, d.salt, 64);
    return a.length === b.length && c.timingSafeEqual(a, b);
  }
  return !!process.env.ADMIN_PASSWORD && same(pw, process.env.ADMIN_PASSWORD);
}
module.exports = { make, ok, same, hash, check };

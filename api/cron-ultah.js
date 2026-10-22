const { db } = require('./_db');

const leap = y => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);

// Dipanggil Vercel Cron setiap hari. Mengirim pengingat Telegram untuk teman yang ulang tahun BESOK (waktu WIB).
module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== 'Bearer ' + secret) return res.status(401).json({ error: 'Tidak diizinkan' });
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return res.json({ skipped: 'TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID belum diatur' });
  try {
    const t = new Date(Date.now() + 7 * 3600e3 + 864e5);
    const Y = t.getUTCFullYear(), M = t.getUTCMonth() + 1, D = t.getUTCDate();
    const d = await (await db()).collection('settings').findOne({ _id: 'ultah' });
    const hit = (d && Array.isArray(d.items) ? d.items : []).filter(x => x.m === M && (x.d === D || (x.d === 29 && M === 2 && D === 28 && !leap(Y))));
    if (!hit.length) return res.json({ sent: 0 });
    const text = '\uD83C\uDF82 Besok ulang tahun:\n' + hit.map(x => '\u2022 ' + x.nama + (x.y ? ' (ke-' + (Y - x.y) + ')' : '') + (x.catatan ? '\n   ' + x.catatan : '')).join('\n') + '\n\nJangan lupa kasih ucapan ya!';
    const r = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text }) });
    if (!r.ok) return res.status(502).json({ error: 'Telegram menolak (' + r.status + ')' });
    res.json({ sent: hit.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};
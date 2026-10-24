const { db } = require('./_db');

const leap = y => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const byJam = (a, b) => (a.jam || '99:99') < (b.jam || '99:99') ? -1 : 1;

// Dipanggil Vercel Cron tiap pagi (08.00 WIB). Mengirim ringkasan harian ke Telegram:
// ulang tahun BESOK, event hari ini dan besok, serta to-do hari ini.
module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== 'Bearer ' + secret) return res.status(401).json({ error: 'Tidak diizinkan' });
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return res.json({ skipped: 'TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID belum diatur' });
  try {
    const w = new Date(Date.now() + 7 * 3600e3), tm = new Date(w.getTime() + 864e5);
    const today = w.toISOString().slice(0, 10), tomo = tm.toISOString().slice(0, 10);
    const Y = tm.getUTCFullYear(), M = tm.getUTCMonth() + 1, D = tm.getUTCDate();
    const col = (await db()).collection('settings');
    const u = await col.findOne({ _id: 'ultah' }), p = await col.findOne({ _id: 'planner' });
    const bd = (u && Array.isArray(u.items) ? u.items : []).filter(x => x.m === M && (x.d === D || (x.d === 29 && M === 2 && D === 28 && !leap(Y))));
    const events = p && Array.isArray(p.events) ? p.events : [], todos = p && Array.isArray(p.todos) ? p.todos : [];
    const evT = events.filter(e => e.tgl === today).sort(byJam), evB = events.filter(e => e.tgl === tomo).sort(byJam);
    const td = todos.filter(t => (t.tgl ? !t.done && t.tgl <= today : t.done !== today));
    const ev = e => '\u2022 ' + (e.jam ? e.jam + ' ' : '') + e.judul + (e.catatan ? '\n   ' + e.catatan : '');
    const sec = [];
    if (bd.length) sec.push('\uD83C\uDF82 Besok ulang tahun:\n' + bd.map(x => '\u2022 ' + x.nama + (x.y ? ' (ke-' + (Y - x.y) + ')' : '') + (x.catatan ? '\n   ' + x.catatan : '')).join('\n'));
    if (evT.length) sec.push('\uD83D\uDCC5 Event hari ini:\n' + evT.map(ev).join('\n'));
    if (evB.length) sec.push('\uD83D\uDCC5 Besok:\n' + evB.map(ev).join('\n'));
    if (td.length) sec.push('\u2705 To-do hari ini:\n' + td.map(t => '\u2610 ' + t.t + (t.tgl && t.tgl < today ? ' (terlambat)' : '')).join('\n'));
    if (!sec.length) return res.json({ sent: 0 });
    const text = ('\u2600\uFE0F Selamat pagi! ' + HARI[w.getUTCDay()] + ', ' + w.getUTCDate() + ' ' + BULAN[w.getUTCMonth()] + '\n\n' + sec.join('\n\n')).slice(0, 4000);
    const r = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text }) });
    if (!r.ok) return res.status(502).json({ error: 'Telegram menolak (' + r.status + ')' });
    res.json({ sent: 1, bagian: sec.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};
const dns = require('dns').promises;
const net = require('net');
const { db } = require('./_db');
const { ok } = require('./_auth');

const MAX_IMG = 3 * 1024 * 1024;
const IMG_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
// Vercel gratis mematikan fungsi di 10 detik. Seluruh proses dibatasi di bawah itu supaya selalu
// membalas JSON (dengan alasan gagal) dan bukan "Gagal" tanpa penjelasan.
const TOTAL_MS = 8000;

function tracker() {
  const end = Date.now() + TOTAL_MS;
  return {
    log: [],
    left: () => end - Date.now(),
    sig: cap => AbortSignal.timeout(Math.max(600, Math.min(cap, end - Date.now())))
  };
}
const why1 = e => (e && e.name === 'TimeoutError' ? 'waktu habis' : (e && e.message) || 'gagal');

function priv(ip) {
  if (net.isIPv6(ip)) return ip === '::1' || /^(fc|fd|fe80)/i.test(ip) || (/^::ffff:/i.test(ip) && priv(ip.split(':').pop()));
  const p = ip.split('.').map(Number);
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
}
async function safe(u) {
  const x = new URL(u);
  if (!/^https?:$/.test(x.protocol)) throw new Error('Link harus diawali https://');
  const ips = net.isIP(x.hostname) ? [x.hostname] : (await dns.lookup(x.hostname, { all: true })).map(a => a.address);
  if (!ips.length || ips.some(priv)) throw new Error('Link tidak diizinkan');
  return x;
}
async function get(T, u, cap, hdr = {}, depth = 0) {
  const x = await safe(u);
  const t0 = Date.now();
  try {
    const r = await fetch(x, { redirect: 'manual', headers: Object.assign({ 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' }, hdr), signal: T.sig(cap) });
    T.log.push(x.hostname + ' -> ' + r.status + ' (' + (Date.now() - t0) + 'ms)');
    const loc = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && loc && depth < 4) return get(T, new URL(loc, x).href, cap, hdr, depth + 1);
    return r;
  } catch (e) {
    T.log.push(x.hostname + ' gagal: ' + why1(e) + ' (' + (Date.now() - t0) + 'ms)');
    throw e;
  }
}
const dec = s => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
function meta(html, k) {
  const a = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + k + '["\'][^>]*content=["\']([^"\']*)["\']', 'i'));
  const b = html.match(new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']' + k + '["\']', 'i'));
  return dec((a || b || [])[1]);
}
const NAMES = [[/tiktok\.com$/, 'TikTok'], [/(^|\.)youtube\.com$|^youtu\.be$/, 'YouTube'], [/wattpad\.com$/, 'Wattpad'], [/instagram\.com$/, 'Instagram'], [/figma\.com$/, 'Figma'], [/canva\.com$/, 'Canva'], [/behance\.net$/, 'Behance'], [/dribbble\.com$/, 'Dribbble']];
const platform = h => (NAMES.find(n => n[0].test(h)) || [0, h])[1];

function sniff(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b.slice(1, 4).toString() === 'PNG') return 'image/png';
  if (b.slice(0, 4).toString() === 'GIF8') return 'image/gif';
  if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  return '';
}
async function save(T, u, ref) {
  // Tanpa "image/*": CDN TikTok kadang membalas HEIC kalau diizinkan, dan HEIC tidak tampil di browser.
  const r = await get(T, u, 4000, { Accept: 'image/webp,image/jpeg,image/png', Referer: ref });
  if (!r.ok) throw new Error('gambar ditolak (' + r.status + ')');
  const buf = Buffer.from(await r.arrayBuffer());
  if (!buf.length) throw new Error('gambar kosong');
  if (buf.length > MAX_IMG) throw new Error('gambar terlalu besar');
  const head = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const type = IMG_OK.includes(head) ? head : sniff(buf);
  if (!type) throw new Error('format gambar tidak didukung (' + (head || 'tidak diketahui') + ')');
  const w = await (await db()).collection('files').insertOne({ type, data: buf, size: buf.length, at: new Date() });
  return '/api/file?id=' + w.insertedId;
}

const unesc = t => String(t || '').replace(/\\u002F/gi, '/').replace(/\\u0026/gi, '&').replace(/\\\//g, '/');
const jsonVal = (html, key) => { const m = html.match(new RegExp('"' + key + '":"([^"]+)"')); return m ? unesc(m[1]) : ''; };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end();
  if (!ok(req)) return res.status(401).json({ error: 'Belum login. Login admin lagi lalu coba ulang.' });
  const T = tracker();
  try {
    const url = String((req.query && req.query.url) || '').trim();
    let x;
    try { x = await safe(url); } catch (e) { return res.status(400).json({ error: e.message || 'Link tidak valid' }); }
    const host = x.hostname.replace(/^www\./, '');
    const isTT = /(^|\.)tiktok\.com$/.test(host);
    const why = [];
    let target = url;
    if (isTT) {
      const short = /^(vm|vt)\./.test(host) || /^\/t\//.test(x.pathname);
      if (short) {
        try { const r0 = await get(T, url, 3500); if (r0.url) target = r0.url; } catch (e) { why.push('link pendek tidak bisa dibuka (' + why1(e) + ')'); }
      }
      target = target.split('?')[0];
      if (short && !/\/(video|photo)\/\d+/.test(target)) why.push('link pendek tidak berubah jadi link video. Buka link itu di browser, lalu salin link lengkapnya (tiktok.com/@nama/video/angka)');
    }
    const isVid = isTT && /\/(video|photo)\/\d+/.test(target);
    let title = '', author = '', img = '';
    const oe = isVid ? 'https://www.tiktok.com/oembed?url=' + encodeURIComponent(target)
      : /(^|\.)youtube\.com$|^youtu\.be$/.test(host) ? 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url) : '';
    if (oe) {
      try {
        const r = await get(T, oe, 3500, { Accept: 'application/json' });
        if (r.ok) { const j = await r.json(); title = j.title || ''; author = j.author_name || ''; img = j.thumbnail_url || ''; if (!img) why.push('oEmbed tanpa gambar'); }
        else why.push('oEmbed ' + r.status + (r.status === 400 || r.status === 404 ? ' (video tidak ditemukan, privat, atau bukan link video)' : r.status === 403 || r.status === 429 ? ' (TikTok menolak permintaan dari server)' : ''));
      } catch (e) { why.push('oEmbed gagal (' + why1(e) + ')'); }
    }
    if ((!img || !title) && T.left() > 1500) {
      try {
        const r = await get(T, isTT ? target : url, 3000, { Accept: 'text/html' });
        if (r.ok) {
          const html = (await r.text()).slice(0, 600000);
          img = img || meta(html, 'og:image') || meta(html, 'twitter:image');
          if (!img && isTT) for (const k of (isVid ? ['originCover', 'cover', 'avatarLarger'] : ['avatarLarger', 'avatarMedium', 'avatarThumb'])) { img = jsonVal(html, k); if (img) break; }
          title = title || meta(html, 'og:title') || (isTT && !isVid ? jsonVal(html, 'nickname') : '') || dec((html.match(/<title[^>]*>([^<]*)/i) || [])[1]);
          if (!author && isTT) author = jsonVal(html, 'nickname');
        } else why.push('halaman ' + r.status + (r.status === 403 || r.status === 429 ? ' (TikTok memblokir server)' : ''));
      } catch (e) { why.push('halaman gagal (' + why1(e) + ')'); }
    }
    let image = '';
    if (img) {
      if (T.left() < 800) why.push('waktu habis sebelum gambar sempat diunduh');
      else { try { image = await save(T, new URL(img, x).href, x.origin + '/'); } catch (e) { why.push(why1(e)); } }
    }
    else if (isTT && !isVid) why.push('link profil atau link tidak dikenali: TikTok hanya memberi gambar untuk link video');
    else if (!why.length) why.push('halaman tidak punya gambar pratinjau');
    const out = { platform: platform(host), url: isVid ? target : '', title: title.trim().slice(0, 200), author, image, why: image ? '' : why.join('; ') };
    if (req.query && req.query.debug) out.steps = T.log;
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal mengambil preview: ' + why1(e) });
  }
};

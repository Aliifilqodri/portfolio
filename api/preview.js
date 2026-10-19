const dns = require('dns').promises;
const net = require('net');
const { db } = require('./_db');
const { ok } = require('./_auth');

const MAX_IMG = 3 * 1024 * 1024;
const IMG_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

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
async function get(u, hdr = {}, depth = 0) {
  const x = await safe(u);
  const r = await fetch(x, { redirect: 'manual', headers: Object.assign({ 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' }, hdr), signal: AbortSignal.timeout(8000) });
  const loc = r.headers.get('location');
  if (r.status >= 300 && r.status < 400 && loc && depth < 4) return get(new URL(loc, x).href, hdr, depth + 1);
  return r;
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
async function save(u, ref) {
  const r = await get(u, { Accept: 'image/jpeg,image/png,image/webp,image/*;q=0.5', Referer: ref });
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

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();
  if (!ok(req)) return res.status(401).json({ error: 'Belum login' });
  try {
    const url = String((req.query && req.query.url) || '').trim();
    let x;
    try { x = await safe(url); } catch (e) { return res.status(400).json({ error: e.message || 'Link tidak valid' }); }
    const host = x.hostname.replace(/^www\./, '');
    const why = [];
    let title = '', author = '', img = '';
    const oe = /(^|\.)tiktok\.com$/.test(host) ? 'https://www.tiktok.com/oembed?url=' + encodeURIComponent(url)
      : /(^|\.)youtube\.com$|^youtu\.be$/.test(host) ? 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url) : '';
    if (oe) {
      try {
        const r = await get(oe, { Accept: 'application/json' });
        if (r.ok) { const j = await r.json(); title = j.title || ''; author = j.author_name || ''; img = j.thumbnail_url || ''; if (!img) why.push('oEmbed tanpa gambar'); }
        else why.push('oEmbed ' + r.status);
      } catch (e) { why.push('oEmbed gagal (' + (e.name === 'TimeoutError' ? 'waktu habis' : e.message) + ')'); }
    }
    if (!img || !title) {
      try {
        const r = await get(url, { Accept: 'text/html' });
        if (r.ok) {
          const html = (await r.text()).slice(0, 400000);
          img = img || meta(html, 'og:image') || meta(html, 'twitter:image');
          title = title || meta(html, 'og:title') || dec((html.match(/<title[^>]*>([^<]*)/i) || [])[1]);
        } else why.push('halaman ' + r.status);
      } catch (e) { why.push('halaman gagal (' + (e.name === 'TimeoutError' ? 'waktu habis' : e.message) + ')'); }
    }
    let image = '';
    if (img) { try { image = await save(new URL(img, x).href, x.origin + '/'); } catch (e) { why.push(e.message); } }
    else if (!why.length) why.push('halaman tidak punya gambar pratinjau');
    res.json({ platform: platform(host), title: title.trim().slice(0, 200), author, image, why: image ? '' : why.join('; ') });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Gagal mengambil preview' });
  }
};
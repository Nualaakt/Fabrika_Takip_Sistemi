// grafik.js — Günlük üretim görsel kartı (PNG)

const { createCanvas } = require('@napi-rs/canvas');
const { uretimOzetle, hurdaOzetle } = require('./rapor');

// ── Renk paleti (orta ton — koyu lacivert) ────────────────────
const C = {
  bg:        '#1e3352',   // dış zemin
  card:      '#253d5c',   // kart zemini
  cardLift:  '#2c4668',   // kart başlık bandı
  cardBdr:   '#335070',   // kenarlık

  ext1:      '#0288d1',   // EXT-1 mavi
  ext1dk:    '#01579b',
  ext2:      '#e64a19',   // EXT-2 turuncu
  ext2dk:    '#bf360c',

  label:     '#6b8aab',   // küçük etiket
  val:       '#d4e3f5',   // normal değer
  valBright: '#ffffff',
  valDim:    '#374d65',
  chrome:    '#8baabf',   // tarih / ikincil

  uretimBg:  '#1a2e20',
  fireBg:    '#2e1a1a',
  uretimHdr: '#4caf7d',
  fireHdr:   '#ef5350',

  rowBase:   '#253d5c',
  rowAlt:    '#1e3452',
  divider:   '#335070',

  fireGood:  '#4caf50',
  fireWarn:  '#ffa726',
  fireBad:   '#ef5350',
  recycleC:  '#29b6f6',
  hurdaC:    '#ef5350',
  ekliC:     '#ffa726',
  eksikBad:  '#ef5350',
  eksikOk:   '#374d65',
  hizC:      '#ce93d8',
  evaC:      '#66bb6a',
  poeC:      '#ffa040',
  beslBg:    '#192030',
};

const pad2  = n => String(n).padStart(2, '0');
const fmtN  = (n, d = 0) => Number(n || 0).toLocaleString('tr-TR', {
  minimumFractionDigits: d, maximumFractionDigits: d,
});
const tarihStr = d =>
  `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;

function fill(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function txt(ctx, s, x, y, font, color, align = 'left', baseline = 'alphabetic') {
  ctx.font        = font;
  ctx.fillStyle   = color;
  ctx.textAlign   = align;
  ctx.textBaseline = baseline;
  ctx.fillText(String(s), x, y);
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
}

function divH(ctx, x, y, w) { fill(ctx, x, y, w, 1, C.divider); }
function divV(ctx, x, y, h) { fill(ctx, x, y, 1, h, C.divider); }

// ── Anlık ürün bilgisi (mod gramaj + genişlik) ─────────────────
function urunBilgisiHesapla(uretimKayitlari) {
  const config = require('./config');
  const hatlar = {};
  for (const r of uretimKayitlari) {
    const hat = config.hatlar[r.UretimHatti] || r.UretimHatti;
    if (!hatlar[hat]) hatlar[hat] = { gramlar: [], genislikler: [], adlar: [] };
    if (r.Gram)     hatlar[hat].gramlar.push(Math.round(r.Gram / 10) * 10);
    if (r.Genislik) hatlar[hat].genislikler.push(r.Genislik);
    if (r.UrunAdi)  hatlar[hat].adlar.push(r.UrunAdi);
  }
  const mod = arr => {
    if (!arr.length) return null;
    const f = {};
    arr.forEach(v => f[v] = (f[v] || 0) + 1);
    return Number(Object.entries(f).sort((a, b) => b[1] - a[1])[0][0]);
  };
  const res = {};
  for (const [hat, d] of Object.entries(hatlar))
    res[hat] = { gram: mod(d.gramlar), genislik: mod(d.genislikler),
                 urunAdi: d.adlar[d.adlar.length - 1] || null };
  return res;
}

// ── Son 10 kayıttan hat hızı ───────────────────────────────────
function hatHizlariniHesapla(uretimKayitlari) {
  const config = require('./config');
  const grp = {};
  for (const r of uretimKayitlari) {
    const hat = config.hatlar[r.UretimHatti] || r.UretimHatti;
    if (!grp[hat]) grp[hat] = [];
    grp[hat].push(r);
  }
  const res = {};
  for (const [hat, rows] of Object.entries(grp)) {
    const vals = rows.slice(-10).map(r => {
      const dk = (new Date(r.BitisSaati) - new Date(r.BaslangicSaati)) / 60000;
      return (dk > 0 && dk < 120) ? (r.MetreKg || 280) / dk : null;
    }).filter(Boolean);
    if (!vals.length) { res[hat] = null; continue; }
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const fil = vals.filter(h => h >= avg * 0.5);
    res[hat] = fil.reduce((a, b) => a + b, 0) / fil.length;
  }
  return res;
}

// ══════════════════════════════════════════════════════════════
//  KART YÜKSEKLİĞİ
// HDR=56 | INFO=52 | URN=30 | SEC=34 | 5×RH=275 | BAR=8 = 455
// ══════════════════════════════════════════════════════════════
const HDR_K = 56;
const INFO_K = 52;
const URN_K  = 30;
const SEC_K  = 34;
const RH     = 55;
const BAR_K  = 8;
const KART_H = HDR_K + INFO_K + URN_K + SEC_K + 5 * RH + BAR_K;  // 455

// ══════════════════════════════════════════════════════════════
//  HAT KARTI
// ══════════════════════════════════════════════════════════════
function hatKartiCiz(ctx, x, y, w, hatAdi, accent, accentDk, u, hd,
                     hiz, basInfo, urunB) {
  const PAD = 18;

  // Kart zemini + ince kenarlık
  fill(ctx, x,     y,     w,     KART_H, C.cardBdr);
  fill(ctx, x + 1, y + 1, w - 2, KART_H - 2, C.card);

  let cy = y + 1;

  // ── Başlık ───────────────────────────────────────────────────
  // Üstten alta degrade etkisi: accent → accentDk
  fill(ctx, x + 1, cy,          w - 2, Math.ceil(HDR_K / 2), accent);
  fill(ctx, x + 1, cy + Math.ceil(HDR_K / 2), w - 2, Math.floor(HDR_K / 2), accentDk);
  txt(ctx, hatAdi, x + w / 2, cy + HDR_K / 2,
    'bold 28px "Segoe UI",Arial', '#ffffff', 'center', 'middle');
  cy += HDR_K;

  // ── Bilgi bandı ──────────────────────────────────────────────
  fill(ctx, x + 1, cy, w - 2, INFO_K, C.cardLift);
  divH(ctx, x + 1, cy + INFO_K - 1, w - 2);

  const col = Math.floor((w - 2) / 3);
  const ix  = x + 1;
  const ly  = cy + Math.round(INFO_K * 0.32);
  const vy  = cy + Math.round(INFO_K * 0.68);

  const basTar = basInfo?.baslangicTarihi
    ? tarihStr(new Date(basInfo.baslangicTarihi)) : '—';
  const gun    = basInfo?.gunSayisi != null ? `${basInfo.gunSayisi} gün` : '—';
  const hizStr = hiz != null ? `${hiz.toFixed(1)} m/dk` : '—';

  txt(ctx, 'BAŞLANGIÇ',          ix + col / 2,            ly, '9px "Segoe UI",Arial',       C.label,  'center', 'middle');
  txt(ctx, basTar,               ix + col / 2,            vy, 'bold 15px "Segoe UI",Arial', C.chrome, 'center', 'middle');

  divV(ctx, ix + col, cy + 10, INFO_K - 20);
  txt(ctx, 'ÇALIŞILAN',          ix + col + col / 2,      ly, '9px "Segoe UI",Arial',       C.label,      'center', 'middle');
  txt(ctx, gun,                  ix + col + col / 2,      vy, 'bold 15px "Segoe UI",Arial', C.valBright,  'center', 'middle');

  divV(ctx, ix + col * 2, cy + 10, INFO_K - 20);
  txt(ctx, 'ORT. SİLİNDİR HIZI', ix + col * 2 + col / 2, ly, '9px "Segoe UI",Arial',       C.label, 'center', 'middle');
  txt(ctx, hizStr,               ix + col * 2 + col / 2, vy, 'bold 14px "Segoe UI",Arial', C.hizC,  'center', 'middle');
  cy += INFO_K;

  // ── Ürün bilgisi bandı ───────────────────────────────────────
  fill(ctx, x + 1, cy, w - 2, URN_K, C.rowAlt);
  divH(ctx, x + 1, cy + URN_K - 1, w - 2);
  const gram = urunB?.gram ? `${urunB.gram} g/m²` : null;
  const gen  = urunB?.genislik ? `${urunB.genislik} mm` : null;
  const adRaw = urunB?.urunAdi || null;
  const ad  = adRaw?.toUpperCase().includes('EPE') ? 'EPE Enkapsülant Film' : adRaw;
  const uStr = [ad, gram, gen].filter(Boolean).join('   ·   ');
  txt(ctx, uStr || '—', x + w / 2, cy + URN_K / 2,
    '11px "Segoe UI",Arial', C.chrome, 'center', 'middle');
  cy += URN_K;

  // ── Bölüm başlıkları ÜRETİM | FİRE ─────────────────────────
  const hw = Math.floor((w - 2) / 2);
  fill(ctx, x + 1,        cy, hw,         SEC_K, C.uretimBg);
  fill(ctx, x + 1 + hw,   cy, w - 2 - hw, SEC_K, C.fireBg);
  txt(ctx, 'ÜRETİM', x + 1 + hw / 2,            cy + SEC_K / 2,
    'bold 15px "Segoe UI",Arial', C.uretimHdr, 'center', 'middle');
  txt(ctx, 'FİRE',   x + 1 + hw + (w-2-hw) / 2,  cy + SEC_K / 2,
    'bold 15px "Segoe UI",Arial', C.fireHdr,   'center', 'middle');
  divV(ctx, x + 1 + hw, cy, SEC_K);
  divH(ctx, x + 1, cy + SEC_K - 1, w - 2);
  cy += SEC_K;

  // ── Veri ─────────────────────────────────────────────────────
  const tamUrun   = u?.tamUrun        || 0;
  const ekliUrun  = u?.ekliUrun       || 0;
  const eksikUrun = u?.eksikUrun      || 0;
  const toplam    = tamUrun + ekliUrun + eksikUrun;
  const toplamM2  = u?.toplamM2       || 0;
  const uretimKg  = u?.toplamUretimKg || 0;
  const labFire   = u?.labFire        || 0;
  const hurdaKg   = hd?.hurda         || 0;
  const recycleKg = (hd?.recycle || 0) + (hd?.sarim || 0) + labFire;
  const topFire   = hurdaKg + recycleKg;
  const topGirdi  = uretimKg + topFire;
  const fireOrani = topGirdi > 0 ? (topFire / topGirdi) * 100 : 0;
  const fireRenk  = fireOrani > 5 ? C.fireBad : fireOrani > 2.5 ? C.fireWarn : C.fireGood;

  const sol = [
    { lbl: 'Tam Ürün',    val: `${fmtN(tamUrun)} adet`,    r: C.val },
    { lbl: 'Ekli Ürün',   val: `${fmtN(ekliUrun)} adet`,   r: ekliUrun  > 0 ? C.ekliC   : C.valDim },
    { lbl: 'Eksik Ürün',  val: `${fmtN(eksikUrun)} adet`,  r: eksikUrun > 0 ? C.eksikBad : C.eksikOk },
    { lbl: 'Toplam Sayı', val: `${fmtN(toplam)} adet`,     r: C.val },
    { lbl: 'Toplam m²',   val: `${fmtN(toplamM2, 1)} m²`,  r: C.val },
  ];
  const sag = [
    { lbl: 'Recycle',     val: `${fmtN(recycleKg, 0)} kg`, r: C.recycleC },
    { lbl: 'Hurda',       val: `${fmtN(hurdaKg,   0)} kg`, r: hurdaKg > 0 ? C.hurdaC : C.valDim },
    { lbl: 'Toplam Fire', val: `${fmtN(topFire,   0)} kg`, r: C.val },
    { lbl: 'Fire Oranı',  val: `%${fireOrani.toFixed(2)}`,  r: fireRenk },
    { lbl: '',            val: '',                           r: C.val },
  ];

  for (let i = 0; i < 5; i++) {
    const ry = cy + i * RH;
    const bg = i % 2 === 0 ? C.rowBase : C.rowAlt;
    fill(ctx, x + 1,        ry, hw,       RH, bg);
    fill(ctx, x + 1 + hw,   ry, w-2-hw,   RH, bg);
    divV(ctx, x + 1 + hw, ry, RH);
    divH(ctx, x + 1, ry + RH - 1, w - 2);

    const rly = ry + Math.round(RH * 0.32);
    const rvy = ry + Math.round(RH * 0.70);

    const lcx = x + 1 + hw / 2;
    const rcx = x + 1 + hw + (w - 2 - hw) / 2;
    txt(ctx, sol[i].lbl, lcx, rly, '13px "Segoe UI",Arial',      C.label,  'center', 'middle');
    txt(ctx, sol[i].val, lcx, rvy, 'bold 17px "Segoe UI",Arial', sol[i].r, 'center', 'middle');
    txt(ctx, sag[i].lbl, rcx, rly, '13px "Segoe UI",Arial',      C.label,  'center', 'middle');
    txt(ctx, sag[i].val, rcx, rvy, 'bold 17px "Segoe UI",Arial', sag[i].r, 'center', 'middle');
  }
  cy += 5 * RH;

  // ── Fire oranı çubuğu ────────────────────────────────────────
  fill(ctx, x + 1, cy, w - 2, BAR_K, C.rowAlt);
  const bw = Math.min(1, fireOrani / 15) * (w - 6);
  if (bw > 0) fill(ctx, x + 3, cy + 2, bw, BAR_K - 4, fireRenk + 'cc');
}

// ══════════════════════════════════════════════════════════════
//  BESLEME KARTI
// ══════════════════════════════════════════════════════════════
function beslemeKartiCiz(ctx, x, y, w, hammaddeler) {
  const H   = 90;
  const HDR = 32;
  const cw  = Math.floor(w / 2);

  fill(ctx, x,     y,     w,     H, C.cardBdr);
  fill(ctx, x + 1, y + 1, w - 2, H - 2, C.beslBg);

  fill(ctx, x + 1, y + 1, w - 2, HDR, C.cardLift);
  txt(ctx, 'BESLEME — KULLANILAN HAMMADDE', x + w / 2, y + 1 + HDR / 2,
    'bold 13px "Segoe UI",Arial', C.val, 'center', 'middle');
  divH(ctx, x + 1, y + 1 + HDR, w - 2);
  divV(ctx, x + cw, y + 1 + HDR, H - HDR - 2);

  const iy = y + 1 + HDR;
  const ih = H - HDR - 2;
  txt(ctx, 'EVA',                       x + cw / 2,      iy + ih * 0.32, '14px "Segoe UI",Arial',       C.label, 'center', 'middle');
  txt(ctx, hammaddeler?.eva || '—',     x + cw / 2,      iy + ih * 0.72, 'bold 18px "Segoe UI",Arial',  C.evaC,  'center', 'middle');
  txt(ctx, 'POE',                       x + cw + cw / 2, iy + ih * 0.32, '14px "Segoe UI",Arial',       C.label, 'center', 'middle');
  txt(ctx, hammaddeler?.poe || '—',     x + cw + cw / 2, iy + ih * 0.72, 'bold 18px "Segoe UI",Arial',  C.poeC,  'center', 'middle');

  return H;
}

// ══════════════════════════════════════════════════════════════
//  ANA FONKSİYON
// ══════════════════════════════════════════════════════════════
function gunlukGrafikOlustur(uretimKayitlari, hurdaKayitlari, tarih,
                              baslangicBilgileri = {}, hammaddeler = null) {
  const W      = 960;
  const PAD    = 14;
  const GAP    = 10;
  const HDR_H  = 58;
  const FTR_H  = 32;
  const BESL_H = hammaddeler ? 90 + GAP : 0;

  const uretim    = uretimOzetle(uretimKayitlari);
  const hurda     = hurdaOzetle(hurdaKayitlari);
  const hizlar    = hatHizlariniHesapla(uretimKayitlari);
  const urunBilgi = urunBilgisiHesapla(uretimKayitlari);
  const hatlar    = Object.keys(uretim).sort();
  const n         = hatlar.length || 1;
  const kartiW    = Math.floor((W - PAD * 2 - GAP * (n - 1)) / n);

  const H = HDR_H + PAD + KART_H + PAD + BESL_H + FTR_H;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // ── Arka plan ────────────────────────────────────────────────
  fill(ctx, 0, 0, W, H, C.bg);

  // ── Üst başlık ───────────────────────────────────────────────
  fill(ctx, 0, 0, W, HDR_H, C.cardLift);
  fill(ctx, 0, 0, 4, HDR_H, C.ext1);
  fill(ctx, 0, HDR_H - 1, W, 1, C.cardBdr);

  txt(ctx, 'Günlük Üretim Raporu', PAD + 12, HDR_H / 2,
    'bold 22px "Segoe UI",Arial', C.valBright, 'left', 'middle');
  txt(ctx, tarihStr(tarih), W - PAD, HDR_H / 2,
    '13px "Segoe UI",Arial', C.chrome, 'right', 'middle');

  // ── Hat kartları ─────────────────────────────────────────────
  const acc = {
    'EXT-1': { accent: C.ext1,  accentDk: C.ext1dk },
    'EXT-2': { accent: C.ext2,  accentDk: C.ext2dk },
  };
  const cy0 = HDR_H + PAD;

  hatlar.forEach((hat, i) => {
    const bx = PAD + i * (kartiW + GAP);
    const a  = acc[hat] || { accent: '#607d8b', accentDk: '#455a64' };
    hatKartiCiz(ctx, bx, cy0, kartiW, hat, a.accent, a.accentDk,
      uretim[hat], hurda[hat], hizlar[hat] ?? null,
      baslangicBilgileri[hat] ?? null, urunBilgi[hat] ?? null);
  });

  // ── BESLEME ──────────────────────────────────────────────────
  if (hammaddeler)
    beslemeKartiCiz(ctx, PAD, cy0 + KART_H + PAD, W - PAD * 2, hammaddeler);

  // ── Alt bilgi ────────────────────────────────────────────────
  const fy = H - FTR_H;
  fill(ctx, 0, fy, W, FTR_H, C.cardLift);
  fill(ctx, 0, fy, W, 1, C.cardBdr);
  txt(ctx, 'CPS Üretim Takip Sistemi  ·  Capssun', W / 2, fy + FTR_H / 2,
    '10px "Segoe UI",Arial', C.label, 'center', 'middle');

  return canvas.toBuffer('image/png');
}

module.exports = { gunlukGrafikOlustur };

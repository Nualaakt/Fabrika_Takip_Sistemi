// grafik.js — Günlük üretim görsel kartı (PNG)

const { createCanvas } = require('@napi-rs/canvas');
const { uretimOzetle, hurdaOzetle } = require('./rapor');

// ── Renk paleti (açık tema) ────────────────────────────────────
const C = {
  bg:        '#edf0f5',
  card:      '#ffffff',
  cardBdr:   '#d8dfe8',

  ext1:      '#0277bd',   // EXT-1 mavi
  ext1lt:    '#e1f0fa',
  ext2:      '#d84315',   // EXT-2 turuncu
  ext2lt:    '#fde8e3',

  label:     '#8fa3b4',
  val:       '#1c2b3a',
  valDim:    '#c0cdd6',
  hdrTxt:    '#ffffff',
  chrome:    '#546e7a',

  uretimBg:  '#f2faf4',
  fireBg:    '#fff5f5',
  uretimHdr: '#2e7d52',
  fireHdr:   '#c0392b',

  rowBase:   '#ffffff',
  rowAlt:    '#f7f9fc',
  divider:   '#e4eaf1',

  fireGood:  '#27ae60',
  fireWarn:  '#e67e22',
  fireBad:   '#e74c3c',
  recycleC:  '#1976d2',
  hurdaC:    '#e74c3c',
  ekliC:     '#e67e22',
  eksikBad:  '#e74c3c',
  eksikOk:   '#c0cdd6',
  hizC:      '#7b1fa2',
  evaC:      '#2e7d32',
  poeC:      '#bf360c',
  beslBg:    '#f5f7fb',
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

// Metin — textBaseline her çağrıda sıfırlanır
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
//  KART YÜKSEKLİĞİ (sabit — hatKartiCiz ile senkron)
// ══════════════════════════════════════════════════════════════
// HDR=56 | INFO=52 | URN=30 | SEC=28 | 5×RH=200 | BAR=8  →  374
const HDR_K = 56;
const INFO_K = 52;
const URN_K  = 30;
const SEC_K  = 28;
const RH     = 40;
const BAR_K  = 8;
const KART_H = HDR_K + INFO_K + URN_K + SEC_K + 5 * RH + BAR_K;  // 374

// ══════════════════════════════════════════════════════════════
//  HAT KARTI
// ══════════════════════════════════════════════════════════════
function hatKartiCiz(ctx, x, y, w, hatAdi, accent, accentLt, u, hd,
                     hiz, basInfo, urunB) {
  const PAD = 18;

  // ── Kart zemini + kenarlık ───────────────────────────────────
  fill(ctx, x,     y,     w,     KART_H, C.cardBdr);
  fill(ctx, x + 1, y + 1, w - 2, KART_H - 2, C.card);

  let cy = y + 1;

  // ── Başlık ───────────────────────────────────────────────────
  fill(ctx, x + 1, cy, w - 2, HDR_K, accent);
  txt(ctx, hatAdi, x + w / 2, cy + HDR_K / 2,
    'bold 28px "Segoe UI",Arial', C.hdrTxt, 'center', 'middle');
  cy += HDR_K;

  // ── Bilgi bandı: başlangıç | gün | hız ───────────────────────
  fill(ctx, x + 1, cy, w - 2, INFO_K, C.rowAlt);
  divH(ctx, x + 1, cy + INFO_K - 1, w - 2);

  const col = Math.floor((w - 2) / 3);
  const ix  = x + 1;
  const ly  = cy + Math.round(INFO_K * 0.32);   // etiket: üst 1/3
  const vy  = cy + Math.round(INFO_K * 0.68);   // değer:  alt 2/3

  const basTar = basInfo?.baslangicTarihi
    ? tarihStr(new Date(basInfo.baslangicTarihi)) : '—';
  const gun    = basInfo?.gunSayisi != null ? `${basInfo.gunSayisi} gün` : '—';
  const hizStr = hiz != null ? `${hiz.toFixed(1)} m/dk` : '—';

  // sütun 1
  txt(ctx, 'BAŞLANGIÇ',           ix + col / 2,             ly, '9px "Segoe UI",Arial',  C.label,  'center', 'middle');
  txt(ctx, basTar,                ix + col / 2,             vy, 'bold 13px "Segoe UI",Arial', C.chrome, 'center', 'middle');
  // sütun 2
  divV(ctx, ix + col,             cy + 10, INFO_K - 20);
  txt(ctx, 'ÇALIŞILAN',           ix + col + col / 2,       ly, '9px "Segoe UI",Arial',  C.label,  'center', 'middle');
  txt(ctx, gun,                   ix + col + col / 2,       vy, 'bold 15px "Segoe UI",Arial', C.val,    'center', 'middle');
  // sütun 3
  divV(ctx, ix + col * 2,         cy + 10, INFO_K - 20);
  txt(ctx, 'ORT. SİLİNDİR HIZI',  ix + col * 2 + col / 2,  ly, '9px "Segoe UI",Arial',  C.label,  'center', 'middle');
  txt(ctx, hizStr,                ix + col * 2 + col / 2,  vy, 'bold 14px "Segoe UI",Arial', C.hizC,   'center', 'middle');
  cy += INFO_K;

  // ── Ürün bilgisi bandı ───────────────────────────────────────
  fill(ctx, x + 1, cy, w - 2, URN_K, accentLt);
  divH(ctx, x + 1, cy + URN_K - 1, w - 2);
  const gram = urunB?.gram ? `${urunB.gram} g/m²` : null;
  const gen  = urunB?.genislik ? `${urunB.genislik} mm` : null;
  const ad   = urunB?.urunAdi || null;
  const uStr = [ad, gram, gen].filter(Boolean).join('   ·   ');
  txt(ctx, uStr || '—', x + w / 2, cy + URN_K / 2,
    '11px "Segoe UI",Arial', C.chrome, 'center', 'middle');
  cy += URN_K;

  // ── Bölüm başlıkları ÜRETİM | FİRE ─────────────────────────
  const hw = Math.floor((w - 2) / 2);
  fill(ctx, x + 1,        cy, hw,       SEC_K, C.uretimBg);
  fill(ctx, x + 1 + hw,   cy, w - 2 - hw, SEC_K, C.fireBg);
  txt(ctx, 'ÜRETİM', x + 1 + hw / 2,           cy + SEC_K / 2,
    'bold 10px "Segoe UI",Arial', C.uretimHdr, 'center', 'middle');
  txt(ctx, 'FİRE',   x + 1 + hw + (w-2-hw) / 2, cy + SEC_K / 2,
    'bold 10px "Segoe UI",Arial', C.fireHdr,   'center', 'middle');
  divV(ctx, x + 1 + hw, cy, SEC_K);
  divH(ctx, x + 1, cy + SEC_K - 1, w - 2);
  cy += SEC_K;

  // ── Veri hesabı ──────────────────────────────────────────────
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
    { lbl: 'Ekli Ürün',   val: `${fmtN(ekliUrun)} adet`,   r: ekliUrun  > 0 ? C.ekliC  : C.valDim },
    { lbl: 'Eksik Ürün',  val: `${fmtN(eksikUrun)} adet`,  r: eksikUrun > 0 ? C.eksikBad : C.eksikOk },
    { lbl: 'Toplam Sayı', val: `${fmtN(toplam)} adet`,     r: C.val },
    { lbl: 'Toplam m²',   val: `${fmtN(toplamM2, 1)} m²`,  r: C.val },
  ];
  const sag = [
    { lbl: 'Recycle',      val: `${fmtN(recycleKg, 0)} kg`, r: C.recycleC },
    { lbl: 'Hurda',        val: `${fmtN(hurdaKg,   0)} kg`, r: hurdaKg > 0 ? C.hurdaC : C.valDim },
    { lbl: 'Toplam Fire',  val: `${fmtN(topFire,   0)} kg`, r: C.val },
    { lbl: 'Fire Oranı',   val: `%${fireOrani.toFixed(2)}`,  r: fireRenk },
    { lbl: '',             val: '',                           r: C.val },
  ];

  for (let i = 0; i < 5; i++) {
    const ry = cy + i * RH;
    const bg = i % 2 === 0 ? C.rowBase : C.rowAlt;
    fill(ctx, x + 1,        ry, hw,       RH, bg);
    fill(ctx, x + 1 + hw,   ry, w-2-hw,   RH, bg);
    divV(ctx, x + 1 + hw, ry, RH);
    divH(ctx, x + 1, ry + RH - 1, w - 2);

    const rly = ry + Math.round(RH * 0.32);  // etiket merkezi
    const rvy = ry + Math.round(RH * 0.70);  // değer merkezi

    txt(ctx, sol[i].lbl, x + 1 + PAD,         rly, '9px "Segoe UI",Arial',       C.label,    'left',  'middle');
    txt(ctx, sol[i].val, x + 1 + hw - PAD,    rvy, 'bold 15px "Segoe UI",Arial', sol[i].r,   'right', 'middle');
    txt(ctx, sag[i].lbl, x + 1 + hw + PAD,    rly, '9px "Segoe UI",Arial',       C.label,    'left',  'middle');
    txt(ctx, sag[i].val, x + 1 + w - 2 - PAD, rvy, 'bold 15px "Segoe UI",Arial', sag[i].r,   'right', 'middle');
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
  const H  = 62;
  const cw = Math.floor(w / 2);

  fill(ctx, x,     y,     w,     H, C.cardBdr);
  fill(ctx, x + 1, y + 1, w - 2, H - 2, C.beslBg);

  // Başlık şeridi
  fill(ctx, x + 1, y + 1, w - 2, 24, C.evaC + '18' || '#e8f5e9');
  fill(ctx, x + 1, y + 1, 3, H - 2, C.evaC || '#27ae60');
  txt(ctx, 'BESLEME — KULLANILAN HAMMADDE', x + w / 2, y + 13,
    'bold 9px "Segoe UI",Arial', C.label, 'center', 'middle');
  divH(ctx, x + 1, y + 24, w - 2);

  divV(ctx, x + cw, y + 24, H - 24);

  txt(ctx, 'EVA',                          x + cw / 2,      y + 36, '9px "Segoe UI",Arial',       C.label, 'center', 'middle');
  txt(ctx, hammaddeler?.eva || '—',        x + cw / 2,      y + 52, 'bold 15px "Segoe UI",Arial', C.evaC,  'center', 'middle');
  txt(ctx, 'POE',                          x + cw + cw / 2, y + 36, '9px "Segoe UI",Arial',       C.label, 'center', 'middle');
  txt(ctx, hammaddeler?.poe || '—',        x + cw + cw / 2, y + 52, 'bold 15px "Segoe UI",Arial', C.poeC,  'center', 'middle');

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
  const BESL_H = hammaddeler ? 62 + GAP : 0;

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
  fill(ctx, 0, 0, W, HDR_H, C.card);
  fill(ctx, 0, 0, 4, HDR_H, C.ext1);
  fill(ctx, 0, HDR_H - 1, W, 1, C.cardBdr);

  txt(ctx, 'Günlük Üretim Raporu', PAD + 12, HDR_H / 2,
    'bold 22px "Segoe UI",Arial', C.val, 'left', 'middle');
  txt(ctx, tarihStr(tarih), W - PAD, HDR_H / 2,
    '13px "Segoe UI",Arial', C.chrome, 'right', 'middle');

  // ── Hat kartları ─────────────────────────────────────────────
  const acc = {
    'EXT-1': { accent: C.ext1, accentLt: C.ext1lt },
    'EXT-2': { accent: C.ext2, accentLt: C.ext2lt },
  };
  const cy0 = HDR_H + PAD;

  hatlar.forEach((hat, i) => {
    const bx = PAD + i * (kartiW + GAP);
    const a  = acc[hat] || { accent: '#607d8b', accentLt: '#eceff1' };
    hatKartiCiz(ctx, bx, cy0, kartiW, hat, a.accent, a.accentLt,
      uretim[hat], hurda[hat], hizlar[hat] ?? null,
      baslangicBilgileri[hat] ?? null, urunBilgi[hat] ?? null);
  });

  // ── BESLEME ──────────────────────────────────────────────────
  if (hammaddeler)
    beslemeKartiCiz(ctx, PAD, cy0 + KART_H + PAD, W - PAD * 2, hammaddeler);

  // ── Alt bilgi ────────────────────────────────────────────────
  const fy = H - FTR_H;
  fill(ctx, 0, fy, W, FTR_H, C.card);
  fill(ctx, 0, fy, W, 1, C.cardBdr);
  txt(ctx, 'CPS Üretim Takip Sistemi  ·  Capssun', W / 2, fy + FTR_H / 2,
    '10px "Segoe UI",Arial', C.label, 'center', 'middle');

  return canvas.toBuffer('image/png');
}

module.exports = { gunlukGrafikOlustur };

// ══════════════════════════════════════════════════════════════
//  grafik.js  –  Günlük üretim görsel kartı (PNG)
// ══════════════════════════════════════════════════════════════

const { createCanvas } = require('@napi-rs/canvas');
const { uretimOzetle, hurdaOzetle } = require('./rapor');

const C = {
  bg:       '#060912',
  card:     '#0c1120',
  cardLift: '#101828',
  border:   '#1e2d45',
  shine:    '#243350',
  ext1:     '#00b4d8',
  ext1glow: '#0077a8',
  ext2:     '#ff6d00',
  ext2glow: '#c44d00',
  label:    '#4a6080',
  labelHi:  '#6a85a8',
  val:      '#dde6f0',
  valBright:'#ffffff',
  dim:      '#2a3d55',
  fireGood: '#00e676',
  fireWarn: '#ffab40',
  fireBad:  '#ff4444',
  recycleC: '#48cae4',
  hurdaC:   '#ff6b6b',
  ekliC:    '#ffab40',
  eksikBad: '#ff4444',
  eksikOk:  '#00e676',
  evaC:     '#69f0ae',
  poeC:     '#ff9e40',
  hizC:     '#b388ff',
  chrome:   '#8899bb',
};

const pad2 = n => String(n).padStart(2, '0');
const fmtN = (n, d = 0) => Number(n || 0).toLocaleString('tr-TR', {
  minimumFractionDigits: d, maximumFractionDigits: d,
});
const tarihStr = d =>
  `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;

function fill(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function txt(ctx, s, x, y, font, color, align = 'left') {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align;
  ctx.fillText(String(s), x, y); ctx.textAlign = 'left';
}

// Metalik yatay çizgi — ince + parlak merkez
function metalLine(ctx, x, y, w, bright = C.shine) {
  fill(ctx, x, y,     w, 1, C.border);
  fill(ctx, x, y + 1, w, 1, bright + '55');
}

// Dikey metalik ayırıcı
function metalVLine(ctx, x, y, h) {
  fill(ctx, x,     y, 1, h, C.border);
  fill(ctx, x + 1, y, 1, h, C.shine + '66');
}

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
    const f = {}; arr.forEach(v => f[v] = (f[v] || 0) + 1);
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
//  HAT KARTI
// ══════════════════════════════════════════════════════════════
function hatKartiCiz(ctx, x, y, w, hatAdi, accent, glow,
                     u, hd, hiz, basInfo, urunB) {
  const PAD = 16;

  // ── Kart zemini ──────────────────────────────────────────────
  fill(ctx, x, y, w, KART_H, C.card);

  // Sol accent şerit (4px)
  fill(ctx, x, y, 4, KART_H, accent);

  // Üst kenar parlak çizgi
  fill(ctx, x, y, w, 1, accent + 'cc');

  let cy = y;

  // ── Başlık ───────────────────────────────────────────────────
  const HDR = 52;
  fill(ctx, x + 4, cy, w - 4, HDR, C.cardLift);
  // İnce alt gölge
  fill(ctx, x + 4, cy + HDR - 1, w - 4, 1, C.border);

  txt(ctx, hatAdi, x + w / 2, cy + 34,
    'bold 26px "Segoe UI",Arial', accent, 'center');
  cy += HDR;

  // ── Bilgi bandı: başlangıç | gün | hız ───────────────────────
  const INFO = 50;
  fill(ctx, x + 4, cy, w - 4, INFO, '#090e1a');
  metalLine(ctx, x + 4, cy + INFO - 1, w - 4);

  const c = Math.floor((w - 4) / 3);
  const ix = x + 4;

  // col 1 — başlangıç
  const basTar = basInfo?.baslangicTarihi
    ? tarihStr(new Date(basInfo.baslangicTarihi)) : '—';
  txt(ctx, 'BAŞLANGIÇ', ix + c / 2, cy + 17,
    '9px "Segoe UI",Arial', C.label, 'center');
  txt(ctx, basTar, ix + c / 2, cy + 38,
    'bold 14px "Segoe UI",Arial', C.chrome, 'center');

  // col 2 — gün
  metalVLine(ctx, ix + c, cy + 10, INFO - 20);
  const gun = basInfo?.gunSayisi != null ? `${basInfo.gunSayisi} GÜN` : '—';
  txt(ctx, 'ÇALIŞILAN', ix + c + c / 2, cy + 17,
    '9px "Segoe UI",Arial', C.label, 'center');
  txt(ctx, gun, ix + c + c / 2, cy + 38,
    'bold 16px "Segoe UI",Arial', C.valBright, 'center');

  // col 3 — hız
  metalVLine(ctx, ix + c * 2, cy + 10, INFO - 20);
  const hizStr = hiz != null ? `${hiz.toFixed(1)} m/dk` : '—';
  txt(ctx, 'ORT. SİLİNDİR HIZI', ix + c * 2 + c / 2, cy + 17,
    '9px "Segoe UI",Arial', C.label, 'center');
  txt(ctx, hizStr, ix + c * 2 + c / 2, cy + 38,
    'bold 14px "Segoe UI",Arial', C.hizC, 'center');
  cy += INFO;

  // ── Ürün bilgisi bandı ───────────────────────────────────────
  const URN = 32;
  fill(ctx, x + 4, cy, w - 4, URN, '#07090f');
  const gram = urunB?.gram ? `${urunB.gram} g/m²` : null;
  const gen  = urunB?.genislik ? `${urunB.genislik} mm` : null;
  const ad   = urunB?.urunAdi || null;
  const uStr = [ad, gram, gen].filter(Boolean).join('   ·   ');
  txt(ctx, uStr || '—', x + w / 2, cy + 21,
    '11px "Segoe UI",Arial', C.labelHi, 'center');
  metalLine(ctx, x + 4, cy + URN - 1, w - 4);
  cy += URN;

  // ── Bölüm başlıkları ÜRETİM | FİRE ─────────────────────────
  const SEC = 30;
  const hw  = Math.floor((w - 4) / 2);
  fill(ctx, x + 4,      cy, hw,     SEC, '#0a1a10');
  fill(ctx, x + 4 + hw, cy, w-4-hw, SEC, '#1a0808');
  txt(ctx, 'ÜRETİM', x + 4 + hw / 2, cy + 20,
    'bold 11px "Segoe UI",Arial', C.fireGood, 'center');
  txt(ctx, 'FİRE',   x + 4 + hw + (w-4-hw) / 2, cy + 20,
    'bold 11px "Segoe UI",Arial', C.fireBad, 'center');
  metalVLine(ctx, x + 4 + hw, cy, SEC);
  metalLine(ctx, x + 4, cy + SEC - 1, w - 4);
  cy += SEC;

  // ── Veri hesabı ──────────────────────────────────────────────
  const tamUrun   = u?.tamUrun   || 0;
  const ekliUrun  = u?.ekliUrun  || 0;
  const eksikUrun = u?.eksikUrun || 0;
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
    { lbl: 'TAM ÜRÜN',    val: `${fmtN(tamUrun)} adet`,    r: C.val },
    { lbl: 'EKLİ ÜRÜN',   val: `${fmtN(ekliUrun)} adet`,   r: ekliUrun  > 0 ? C.ekliC   : C.dim },
    { lbl: 'EKSİK ÜRÜN',  val: `${fmtN(eksikUrun)} adet`,  r: eksikUrun > 0 ? C.eksikBad : C.eksikOk },
    { lbl: 'TOPLAM SAYI', val: `${fmtN(toplam)} adet`,     r: C.valBright },
    { lbl: 'TOPLAM m²',   val: `${fmtN(toplamM2, 1)} m²`,  r: C.valBright },
  ];
  const sag = [
    { lbl: 'RECYCLE',      val: `${fmtN(recycleKg, 0)} kg`, r: C.recycleC },
    { lbl: 'HURDA',        val: `${fmtN(hurdaKg,   0)} kg`, r: hurdaKg > 0 ? C.hurdaC : C.dim },
    { lbl: 'TOPLAM FİRE',  val: `${fmtN(topFire,   0)} kg`, r: C.val },
    { lbl: 'FİRE ORANI',   val: `%${fireOrani.toFixed(2)}`,  r: fireRenk },
    { lbl: '',             val: '',                           r: C.val },
  ];

  const RH = 40;
  for (let i = 0; i < 5; i++) {
    const ry = cy + i * RH;
    const bg = i % 2 === 0 ? C.card : '#0a101e';
    fill(ctx, x + 4,      ry, hw,     RH, bg);
    fill(ctx, x + 4 + hw, ry, w-4-hw, RH, bg);
    metalVLine(ctx, x + 4 + hw, ry, RH);
    metalLine(ctx, x + 4, ry + RH - 1, w - 4);

    txt(ctx, sol[i].lbl, x + 4 + PAD,      ry + 16, '9px "Segoe UI",Arial', C.label);
    txt(ctx, sol[i].val, x + 4 + hw - PAD, ry + 33, 'bold 15px "Segoe UI",Arial', sol[i].r, 'right');
    txt(ctx, sag[i].lbl, x + 4 + hw + PAD,  ry + 16, '9px "Segoe UI",Arial', C.label);
    txt(ctx, sag[i].val, x + 4 + w - PAD,   ry + 33, 'bold 15px "Segoe UI",Arial', sag[i].r, 'right');
  }
  cy += 5 * RH;

  // ── Fire oranı çubuğu ────────────────────────────────────────
  const BH = 12;
  fill(ctx, x + 4, cy, w - 4, BH, '#050810');
  const bw = Math.min(1, fireOrani / 15) * (w - 8);
  fill(ctx, x + 6, cy + 3, bw, BH - 6, fireRenk);
  // parlak kenar
  fill(ctx, x + 6, cy + 3, bw, 1, fireRenk + 'cc');
  cy += BH;

  // Alt kenar
  fill(ctx, x, cy, w, 1, glow + '55');
}

// ── Toplam kart yüksekliği (sabit — hatKartiCiz ile senkron) ──
const KART_H = 52 + 50 + 32 + 30 + 5 * 40 + 12;  // = 376

// ══════════════════════════════════════════════════════════════
//  BESLEME KARTI
// ══════════════════════════════════════════════════════════════
function beslemeKartiCiz(ctx, x, y, w, hammaddeler) {
  const H  = 64;
  const cw = Math.floor(w / 2);
  fill(ctx, x, y, w, H, C.card);
  fill(ctx, x, y, w, 1, '#1a4030');

  fill(ctx, x, y, 4, H, C.evaC + 'aa');

  // Başlık
  fill(ctx, x + 4, y, w - 4, 24, '#091a10');
  txt(ctx, 'BESLEME', x + w / 2, y + 16,
    'bold 10px "Segoe UI",Arial', C.evaC + 'cc', 'center');
  metalLine(ctx, x + 4, y + 23, w - 4);

  metalVLine(ctx, x + cw, y + 24, H - 24);

  txt(ctx, 'KULLANILAN EVA HAMMADDESİ', x + cw / 2,      y + 36, '9px "Segoe UI",Arial', C.label, 'center');
  txt(ctx, hammaddeler?.eva || '—',      x + cw / 2,      y + 54, 'bold 15px "Segoe UI",Arial', C.evaC, 'center');
  txt(ctx, 'KULLANILAN POE HAMMADDESİ', x + cw + cw / 2, y + 36, '9px "Segoe UI",Arial', C.label, 'center');
  txt(ctx, hammaddeler?.poe || '—',      x + cw + cw / 2, y + 54, 'bold 15px "Segoe UI",Arial', C.poeC, 'center');

  fill(ctx, x, y + H - 1, w, 1, C.border);
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
  const HDR_H  = 60;
  const FTR_H  = 34;
  const BESL_H = hammaddeler ? 64 + GAP : 0;

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

  // Hafif doku: yatay çizgi deseni
  for (let i = 0; i < H; i += 4)
    fill(ctx, 0, i, W, 1, 'rgba(255,255,255,0.012)');

  // ── Üst başlık ───────────────────────────────────────────────
  fill(ctx, 0, 0, W, HDR_H, '#070c18');
  // Sol dikey accent bar
  fill(ctx, 0, 0, 3, HDR_H, C.ext1);
  fill(ctx, 3, 0, 3, HDR_H, C.ext1 + '44');

  txt(ctx, 'GÜNLÜK ÜRETİM RAPORU', PAD + 12, 38,
    'bold 24px "Segoe UI",Arial', C.valBright);
  txt(ctx, tarihStr(tarih), W - PAD, 42,
    '14px "Segoe UI",Arial', C.chrome, 'right');

  // Alt metalik çizgi
  metalLine(ctx, 0, HDR_H - 2, W, C.ext1 + '66');

  // ── Hat kartları ─────────────────────────────────────────────
  const acc = {
    'EXT-1': { accent: C.ext1, glow: C.ext1glow },
    'EXT-2': { accent: C.ext2, glow: C.ext2glow },
  };
  const cy0 = HDR_H + PAD;

  hatlar.forEach((hat, i) => {
    const bx = PAD + i * (kartiW + GAP);
    const a  = acc[hat] || { accent: '#607080', glow: '#304050' };
    hatKartiCiz(ctx, bx, cy0, kartiW, hat, a.accent, a.glow,
      uretim[hat], hurda[hat], hizlar[hat] ?? null,
      baslangicBilgileri[hat] ?? null, urunBilgi[hat] ?? null);
  });

  // ── BESLEME ──────────────────────────────────────────────────
  if (hammaddeler)
    beslemeKartiCiz(ctx, PAD, cy0 + KART_H + PAD, W - PAD * 2, hammaddeler);

  // ── Alt bilgi ────────────────────────────────────────────────
  const fy = H - FTR_H;
  fill(ctx, 0, fy, W, FTR_H, '#070c18');
  metalLine(ctx, 0, fy, W);
  txt(ctx, 'CPS Üretim Takip Sistemi  ·  Capssun', W / 2, fy + 23,
    '11px "Segoe UI",Arial', C.label, 'center');

  return canvas.toBuffer('image/png');
}

module.exports = { gunlukGrafikOlustur };

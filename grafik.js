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

// ══════════════════════════════════════════════════════════════
//  FİRE TREND GRAFİĞİ
//  veri: [{ tarih, gunlukOran, kumulatifOran }]
//  hatAdi: 'EXT-1' | 'EXT-2'
// ══════════════════════════════════════════════════════════════
function fireGrafikOlustur(veri, hatAdi) {
  const accent = hatAdi === 'EXT-2' ? C.ext2 : C.ext1;

  const W      = 960;
  const H      = 400;
  const PAD_L  = 58;   // sol Y ekseni
  const PAD_R  = 62;   // sağ Y ekseni
  const PAD_T  = 54;   // başlık
  const PAD_B  = 44;   // X ekseni tarihleri

  const cX = PAD_L;
  const cY = PAD_T;
  const cW = W - PAD_L - PAD_R;
  const cH = H - PAD_T - PAD_B;

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // ── Arka plan ────────────────────────────────────────────────
  fill(ctx, 0, 0, W, H, C.bg);
  fill(ctx, cX, cY, cW, cH, C.rowAlt);

  // ── Başlık ───────────────────────────────────────────────────
  fill(ctx, 0, 0, W, PAD_T - 2, C.cardLift);
  fill(ctx, 0, 0, 4, PAD_T - 2, accent);
  fill(ctx, 0, PAD_T - 2, W, 1, C.cardBdr);
  txt(ctx, `${hatAdi} — FİRE ORANI`, PAD_L, (PAD_T - 2) / 2,
    'bold 16px "Segoe UI",Arial', C.valBright, 'left', 'middle');

  if (!veri || veri.length === 0) {
    txt(ctx, 'Veri yok', W / 2, H / 2, '14px "Segoe UI",Arial', C.label, 'center', 'middle');
    return canvas.toBuffer('image/png');
  }

  const N = veri.length;

  // ── Y ekseni ölçekleri ───────────────────────────────────────
  const maxGunluk    = Math.max(...veri.map(d => d.gunlukOran),    0.1);
  const maxKumulatif = Math.max(...veri.map(d => d.kumulatifOran), 0.1);
  const yMaxL = Math.ceil(maxGunluk    / 5) * 5 || 5;
  const yMaxR = Math.ceil(maxKumulatif / 5) * 5 || 5;

  // Yardımcı: veri değerini sol/sağ Y pozisyonuna çevir
  const yL = v => cY + cH - (v / yMaxL) * cH;
  const yR = v => cY + cH - (v / yMaxR) * cH;
  const xOf = i => cX + (i + 0.5) * (cW / N);

  // ── Yatay grid çizgileri (sol eksen adımları) ────────────────
  const gridStep = yMaxL <= 10 ? 1 : yMaxL <= 20 ? 2 : 5;
  for (let v = 0; v <= yMaxL; v += gridStep) {
    const gy = Math.round(yL(v));
    fill(ctx, cX, gy, cW, 1, C.divider);
    txt(ctx, `%${v}`, cX - 6, gy, '10px "Segoe UI",Arial', C.label, 'right', 'middle');
  }

  // Sağ Y ekseni etiketleri
  const gridStepR = yMaxR <= 10 ? 1 : yMaxR <= 20 ? 2 : 5;
  for (let v = 0; v <= yMaxR; v += gridStepR) {
    const gy = Math.round(yR(v));
    txt(ctx, `%${v}`, cX + cW + 6, gy, '10px "Segoe UI",Arial', C.chrome, 'left', 'middle');
  }

  // Sol eksen başlığı
  txt(ctx, 'Günlük', 10, cY + cH / 2, '10px "Segoe UI",Arial', C.label, 'center', 'middle');
  // Sağ eksen başlığı
  txt(ctx, 'Kümülatif', W - 10, cY + cH / 2, '10px "Segoe UI",Arial', C.chrome, 'center', 'middle');

  // ── Çubuklar (günlük fire %) ─────────────────────────────────
  const barW = Math.max(4, (cW / N) * 0.65);
  for (let i = 0; i < N; i++) {
    const v  = veri[i].gunlukOran;
    const bx = xOf(i) - barW / 2;
    const by = yL(v);
    const bh = cY + cH - by;
    if (bh > 0) {
      fill(ctx, Math.round(bx), Math.round(by), Math.round(barW), Math.round(bh), accent + 'cc');
      fill(ctx, Math.round(bx), Math.round(by), Math.round(barW), 2, accent);
    }
  }

  // ── Kümülatif çizgi ─────────────────────────────────────────
  ctx.beginPath();
  ctx.strokeStyle = '#ffa726';
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = 'round';
  for (let i = 0; i < N; i++) {
    const px = xOf(i);
    const py = yR(veri[i].kumulatifOran);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Çizgi üzerindeki noktalar
  for (let i = 0; i < N; i++) {
    const px = xOf(i);
    const py = yR(veri[i].kumulatifOran);
    fill(ctx, px - 3, py - 3, 6, 6, '#ffa726');
  }

  // ── Veri etiketleri ─────────────────────────────────────────
  // Hangi noktalara etiket: ilk, son, yerel zirve (komşulardan büyük)
  const etiketGoster = i => {
    if (i === 0 || i === N - 1) return true;
    return veri[i].gunlukOran > veri[i-1].gunlukOran &&
           veri[i].gunlukOran > veri[i+1].gunlukOran &&
           veri[i].gunlukOran > 1;
  };

  for (let i = 0; i < N; i++) {
    if (!etiketGoster(i)) continue;
    const v  = veri[i].gunlukOran;
    const px = xOf(i);
    const by = yL(v) - 6;
    // Etiket kutusu
    const lbl = `%${v.toFixed(1)}`;
    fill(ctx, px - 18, by - 14, 36, 16, C.cardLift + 'dd');
    txt(ctx, lbl, px, by - 5, 'bold 10px "Segoe UI",Arial', C.valBright, 'center', 'middle');
  }

  // ── X ekseni tarihleri ───────────────────────────────────────
  const adim = N <= 15 ? 1 : N <= 30 ? 2 : 3;
  for (let i = 0; i < N; i += adim) {
    const tarih = veri[i].tarih; // 'YYYY-MM-DD'
    const [yil, ay, gun] = tarih.split('-');
    const lbl = `${gun}.${ay}`;
    const px  = xOf(i);
    txt(ctx, lbl, px, cY + cH + 14, '10px "Segoe UI",Arial', C.label, 'center', 'middle');
  }

  // ── Eksen çerçevesi ─────────────────────────────────────────
  fill(ctx, cX, cY + cH, cW, 1, C.divider);   // alt
  fill(ctx, cX, cY, 1, cH, C.divider);         // sol
  fill(ctx, cX + cW, cY, 1, cH, C.divider);    // sağ

  // ── Legend ───────────────────────────────────────────────────
  const ly = H - 12;
  fill(ctx, W / 2 - 100, ly - 6, 14, 10, accent + 'cc');
  txt(ctx, 'Günlük fire', W / 2 - 82, ly - 1, '10px "Segoe UI",Arial', C.label, 'left', 'middle');
  fill(ctx, W / 2 + 30, ly - 3, 14, 4, '#ffa726');
  txt(ctx, 'Kümülatif', W / 2 + 48, ly - 1, '10px "Segoe UI",Arial', C.chrome, 'left', 'middle');

  return canvas.toBuffer('image/png');
}

module.exports = { gunlukGrafikOlustur, fireGrafikOlustur };

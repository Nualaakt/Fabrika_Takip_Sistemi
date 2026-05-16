// ══════════════════════════════════════════════════════════════
//  grafik.js  –  Günlük üretim görsel kartı (PNG)
//
//  gunlukGrafikOlustur(uretimKayitlari, hurdaKayitlari, tarih,
//                      baslangicBilgileri, hammaddeler)
//  → Buffer (image/png)
// ══════════════════════════════════════════════════════════════

const { createCanvas } = require('@napi-rs/canvas');
const { uretimOzetle, hurdaOzetle } = require('./rapor');

// ── Renk paleti (koyu modern tema) ───────────────────────────
const C = {
  pageBg:    '#0f172a',
  cardBg:    '#1e293b',
  cardBdr:   '#334155',
  ext1:      '#3b82f6',   // elektrik mavi
  ext1dim:   '#1d4ed8',
  ext2:      '#f97316',   // amber turuncu
  ext2dim:   '#c2410c',
  uretimAcc: '#facc15',   // sarı
  fireAcc:   '#ef4444',   // kırmızı
  beslAcc:   '#22c55e',   // yeşil
  label:     '#94a3b8',   // gri-mavi
  value:     '#f1f5f9',   // neredeyse beyaz
  dimVal:    '#cbd5e1',
  fireOk:    '#4ade80',
  fireWarn:  '#fb923c',
  fireBad:   '#f87171',
  recycleC:  '#60a5fa',
  hurdaC:    '#f87171',
  ekliC:     '#fb923c',
  eksikBad:  '#f87171',
  eksikOk:   '#4ade80',
  evaC:      '#34d399',
  poeC:      '#fb923c',
  divider:   '#334155',
  hizC:      '#a78bfa',   // mor
};

const pad2 = n => String(n).padStart(2, '0');
const fmtN = (n, d = 0) => Number(n || 0).toLocaleString('tr-TR', {
  minimumFractionDigits: d, maximumFractionDigits: d,
});
function tarihStr(d) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function fillRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function roundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function text(ctx, str, x, y, font, color, align = 'left') {
  ctx.font      = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(String(str), x, y);
  ctx.textAlign = 'left';
}

// ── KPI kutusu: etiket üstte küçük, değer altta büyük ────────
function kpi(ctx, etiket, deger, renk, x, y, w, h) {
  text(ctx, etiket, x + w / 2, y + 17, '10px "Segoe UI",Arial', C.label, 'center');
  text(ctx, deger,  x + w / 2, y + h - 10, 'bold 15px "Segoe UI",Arial', renk, 'center');
}

// ── Yatay ince çizgi ─────────────────────────────────────────
function divider(ctx, x, y, w) {
  fillRect(ctx, x, y, w, 1, C.divider);
}

// ── Anlık ürün bilgisini hesapla (mod gramaj + genişlik) ──────
function urunBilgisiHesapla(uretimKayitlari) {
  const config  = require('./config');
  const hatlar  = {};
  for (const r of uretimKayitlari) {
    const hat = config.hatlar[r.UretimHatti] || r.UretimHatti;
    if (!hatlar[hat]) hatlar[hat] = { gramlar: [], genislikler: [], urunAdlari: [] };
    if (r.Gram)    hatlar[hat].gramlar.push(Math.round(r.Gram / 10) * 10);
    if (r.Genislik) hatlar[hat].genislikler.push(r.Genislik);
    if (r.UrunAdi) hatlar[hat].urunAdlari.push(r.UrunAdi);
  }
  const mod = arr => {
    if (!arr.length) return null;
    const freq = {};
    arr.forEach(v => freq[v] = (freq[v] || 0) + 1);
    return Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
  };
  const sonuc = {};
  for (const [hat, d] of Object.entries(hatlar)) {
    sonuc[hat] = {
      gram:    mod(d.gramlar),
      genislik: mod(d.genislikler),
      urunAdi: d.urunAdlari[d.urunAdlari.length - 1] || null,
    };
  }
  return sonuc;
}

// ── Son 10 kayıttan hat hızı ──────────────────────────────────
function hatHizlariniHesapla(uretimKayitlari) {
  const config = require('./config');
  const hatGruplari = {};
  for (const r of uretimKayitlari) {
    const hat = config.hatlar[r.UretimHatti] || r.UretimHatti;
    if (!hatGruplari[hat]) hatGruplari[hat] = [];
    hatGruplari[hat].push(r);
  }
  const hizlar = {};
  for (const [hat, kayitlar] of Object.entries(hatGruplari)) {
    const son10 = kayitlar.slice(-10);
    const vals = son10.map(r => {
      const dk = (new Date(r.BitisSaati) - new Date(r.BaslangicSaati)) / 60000;
      if (dk <= 0 || dk > 120) return null;
      return (r.MetreKg || 280) / dk;
    }).filter(Boolean);
    if (!vals.length) { hizlar[hat] = null; continue; }
    const ort = vals.reduce((a, b) => a + b, 0) / vals.length;
    const fil = vals.filter(h => h >= ort * 0.5);
    hizlar[hat] = fil.reduce((a, b) => a + b, 0) / fil.length;
  }
  return hizlar;
}

// ── Hat kartını çiz ───────────────────────────────────────────
function hatKartiCiz(ctx, x, y, w, hatAdi, accent, accentDim,
                     u, hd, hiz, baslangicInfo, urunBilgisi) {
  const R     = 10;
  const CARD  = w;
  const PAD   = 14;

  // ── Kart arka planı ──────────────────────────────────────────
  roundRect(ctx, x, y, CARD, 0, R, C.cardBg); // yüksekliği aşağıda hesaplayacağız

  let cy = y;

  // ── Hat başlık bandı ─────────────────────────────────────────
  const HDR_H = 46;
  roundRect(ctx, x, cy, CARD, HDR_H, R, accent);
  fillRect(ctx, x, cy + R, CARD, HDR_H - R, accent); // alt yarı düz
  text(ctx, hatAdi, x + CARD / 2, cy + 30, 'bold 22px "Segoe UI",Arial', '#ffffff', 'center');
  cy += HDR_H;

  // ── Bilgi satırı: başlangıç | gün | hız ─────────────────────
  const INFO_H = 48;
  fillRect(ctx, x, cy, CARD, INFO_H, accentDim);

  const basTarih = baslangicInfo?.baslangicTarihi
    ? tarihStr(new Date(baslangicInfo.baslangicTarihi)) : '—';
  const gunSay  = baslangicInfo?.gunSayisi != null
    ? `${baslangicInfo.gunSayisi} gün` : '—';
  const hizStr  = hiz != null ? `${hiz.toFixed(1)} m/dk` : '—';

  const c3 = Math.floor(CARD / 3);
  // col 1
  text(ctx, 'BAŞLANGIÇ', x + c3 / 2, cy + 16, '9px "Segoe UI",Arial', 'rgba(255,255,255,0.6)', 'center');
  text(ctx, basTarih,    x + c3 / 2, cy + 35, 'bold 13px "Segoe UI",Arial', '#ffffff', 'center');
  // col 2
  fillRect(ctx, x + c3, cy + 8, 1, INFO_H - 16, 'rgba(255,255,255,0.2)');
  text(ctx, 'ÇALIŞILAN',  x + c3 + c3 / 2, cy + 16, '9px "Segoe UI",Arial', 'rgba(255,255,255,0.6)', 'center');
  text(ctx, gunSay,       x + c3 + c3 / 2, cy + 35, 'bold 15px "Segoe UI",Arial', '#ffffff', 'center');
  // col 3
  fillRect(ctx, x + c3 * 2, cy + 8, 1, INFO_H - 16, 'rgba(255,255,255,0.2)');
  text(ctx, 'ORT. SİL. HIZI', x + c3 * 2 + c3 / 2, cy + 16, '9px "Segoe UI",Arial', 'rgba(255,255,255,0.6)', 'center');
  text(ctx, hizStr,           x + c3 * 2 + c3 / 2, cy + 35, 'bold 13px "Segoe UI",Arial', C.hizC, 'center');

  cy += INFO_H;

  // ── Anlık ürün bilgisi ────────────────────────────────────────
  const URN_H = 36;
  fillRect(ctx, x, cy, CARD, URN_H, '#0f172a');
  const gram    = urunBilgisi?.gram    != null ? `${urunBilgisi.gram} g/m²` : '—';
  const genislik = urunBilgisi?.genislik != null ? `${urunBilgisi.genislik} mm` : '—';
  const urunAdi  = urunBilgisi?.urunAdi || '';
  const urunStr  = [urunAdi, gram, genislik].filter(Boolean).join('  ·  ');
  text(ctx, '▶ ' + urunStr, x + CARD / 2, cy + 23,
    '12px "Segoe UI",Arial', C.dimVal, 'center');
  divider(ctx, x, cy, CARD);
  divider(ctx, x, cy + URN_H, CARD);

  cy += URN_H;

  // ── ÜRETİM / FİRE başlıkları ─────────────────────────────────
  const SEC_H = 28;
  const halfW = Math.floor(CARD / 2);
  fillRect(ctx, x,       cy, halfW, SEC_H, '#1a2e1a');
  fillRect(ctx, x + halfW, cy, CARD - halfW, SEC_H, '#2d1515');
  text(ctx, 'ÜRETİM', x + halfW / 2,           cy + 18, 'bold 11px "Segoe UI",Arial', C.uretimAcc, 'center');
  text(ctx, 'FİRE',   x + halfW + (CARD - halfW) / 2, cy + 18, 'bold 11px "Segoe UI",Arial', C.fireAcc,  'center');
  fillRect(ctx, x + halfW, cy, 1, SEC_H, C.divider);
  cy += SEC_H;

  // ── Veri hesapla ─────────────────────────────────────────────
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
  const fireRenk  = fireOrani > 5 ? C.fireBad : fireOrani > 2.5 ? C.fireWarn : C.fireOk;

  // ── Veri satırları (2 sütun) ──────────────────────────────────
  const ROW_H = 42;
  const satırlar = [
    { u: { et: 'Tam Ürün',    val: `${fmtN(tamUrun)} adet`,   renk: C.value  },
      f: { et: 'Recycle',     val: `${fmtN(recycleKg, 0)} kg`, renk: C.recycleC } },
    { u: { et: 'Ekli Ürün',   val: `${fmtN(ekliUrun)} adet`,  renk: ekliUrun  > 0 ? C.ekliC   : C.dimVal },
      f: { et: 'Hurda',       val: `${fmtN(hurdaKg,  0)} kg`, renk: hurdaKg   > 0 ? C.hurdaC  : C.dimVal } },
    { u: { et: 'Eksik Ürün',  val: `${fmtN(eksikUrun)} adet`, renk: eksikUrun > 0 ? C.eksikBad : C.eksikOk },
      f: { et: 'Toplam Fire', val: `${fmtN(topFire,  0)} kg`, renk: C.dimVal  } },
    { u: { et: 'Toplam Sayı', val: `${fmtN(toplam)} adet`,    renk: C.value  },
      f: { et: 'Fire Oranı',  val: `%${fireOrani.toFixed(2)}`, renk: fireRenk } },
    { u: { et: 'Toplam m²',   val: `${fmtN(toplamM2, 1)} m²`, renk: C.value  },
      f: null },
  ];

  for (let i = 0; i < satırlar.length; i++) {
    const ry  = cy + i * ROW_H;
    const bg  = i % 2 === 0 ? C.cardBg : '#253347';
    fillRect(ctx, x, ry, CARD, ROW_H, bg);
    fillRect(ctx, x + halfW, ry, 1, ROW_H, C.divider);
    divider(ctx, x, ry + ROW_H, CARD);

    const s = satırlar[i];
    // Sol
    text(ctx, s.u.et,  x + PAD,        ry + 16, '10px "Segoe UI",Arial', C.label);
    text(ctx, s.u.val, x + halfW - PAD, ry + 32, 'bold 14px "Segoe UI",Arial', s.u.renk, 'right');

    // Sağ
    if (s.f) {
      text(ctx, s.f.et,  x + halfW + PAD,  ry + 16, '10px "Segoe UI",Arial', C.label);
      text(ctx, s.f.val, x + CARD - PAD,   ry + 32, 'bold 14px "Segoe UI",Arial', s.f.renk, 'right');
    }
  }
  cy += satırlar.length * ROW_H;

  // ── Fire oranı görsel çubuğu ──────────────────────────────────
  const BAR_H = 10;
  fillRect(ctx, x, cy, CARD, BAR_H, '#0f172a');
  const barW = Math.min(1, fireOrani / 15) * (CARD - 2);
  fillRect(ctx, x + 1, cy + 2, barW, BAR_H - 4, fireRenk);
  cy += BAR_H;

  // Kart alt yuvarlak köşe
  fillRect(ctx, x, cy - R, CARD, R, C.cardBg);
  roundRect(ctx, x, cy - R, CARD, R, R, C.cardBg);
  // Gerçek alt sınır:
  const totalH = cy - y;

  // Kart border
  ctx.strokeStyle = C.cardBdr;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(x + R, y);
  ctx.lineTo(x + CARD - R, y);
  ctx.quadraticCurveTo(x + CARD, y, x + CARD, y + R);
  ctx.lineTo(x + CARD, cy);
  ctx.lineTo(x, cy);
  ctx.lineTo(x, y + R);
  ctx.quadraticCurveTo(x, y, x + R, y);
  ctx.closePath();
  ctx.stroke();

  return totalH;
}

// ── BESLEME kartı ─────────────────────────────────────────────
function beslemeKartiCiz(ctx, x, y, w, hammaddeler) {
  const H   = 68;
  const R   = 8;
  const cw  = Math.floor(w / 2);

  roundRect(ctx, x, y, w, H, R, C.cardBg);
  ctx.strokeStyle = C.cardBdr;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(x + R, y); ctx.lineTo(x + w - R, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + R);
  ctx.lineTo(x + w, y + H - R);
  ctx.quadraticCurveTo(x + w, y + H, x + w - R, y + H);
  ctx.lineTo(x + R, y + H);
  ctx.quadraticCurveTo(x, y + H, x, y + H - R);
  ctx.lineTo(x, y + R);
  ctx.quadraticCurveTo(x, y, x + R, y);
  ctx.closePath();
  ctx.stroke();

  // Başlık şeridi
  roundRect(ctx, x, y, w, 24, R, '#14532d');
  fillRect(ctx, x, y + R, w, 24 - R, '#14532d');
  text(ctx, 'BESLEME', x + w / 2, y + 16, 'bold 11px "Segoe UI",Arial', C.beslAcc, 'center');

  fillRect(ctx, x + cw, y + 24, 1, H - 24, C.divider);

  text(ctx, 'Kullanılan EVA Hammaddesi', x + cw / 2,       y + 38, '10px "Segoe UI",Arial', C.label, 'center');
  text(ctx, hammaddeler?.eva || '—',     x + cw / 2,       y + 58, 'bold 15px "Segoe UI",Arial', C.evaC, 'center');
  text(ctx, 'Kullanılan POE Hammaddesi', x + cw + cw / 2,  y + 38, '10px "Segoe UI",Arial', C.label, 'center');
  text(ctx, hammaddeler?.poe || '—',     x + cw + cw / 2,  y + 58, 'bold 15px "Segoe UI",Arial', C.poeC, 'center');

  return H;
}

// ── Ana fonksiyon ─────────────────────────────────────────────
function gunlukGrafikOlustur(uretimKayitlari, hurdaKayitlari, tarih,
                              baslangicBilgileri = {}, hammaddeler = null) {
  const W      = 920;
  const PAD    = 16;
  const GAP    = 12;

  const uretim    = uretimOzetle(uretimKayitlari);
  const hurda     = hurdaOzetle(hurdaKayitlari);
  const hizlar    = hatHizlariniHesapla(uretimKayitlari);
  const urunBilgi = urunBilgisiHesapla(uretimKayitlari);
  const hatlar    = Object.keys(uretim).sort();

  const sutunSayisi = hatlar.length || 1;
  const kartiW = Math.floor((W - PAD * 2 - GAP * (sutunSayisi - 1)) / sutunSayisi);

  // Hat kartı yüksekliği: 46+48+36+28+5*42+10 = 378
  const KART_H   = 46 + 48 + 36 + 28 + 5 * 42 + 10;
  const HEADER_H = 64;
  const FOOTER_H = 36;
  const BESL_H   = hammaddeler ? 68 + GAP : 0;

  const H = HEADER_H + PAD + KART_H + PAD + BESL_H + FOOTER_H;

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // ── Arka plan ────────────────────────────────────────────────
  fillRect(ctx, 0, 0, W, H, C.pageBg);

  // ── Üst başlık ───────────────────────────────────────────────
  fillRect(ctx, 0, 0, W, HEADER_H, '#0f172a');
  // Sol şerit (accent)
  fillRect(ctx, 0, 0, 4, HEADER_H, C.ext1);
  text(ctx, 'GÜNLÜK ÜRETİM RAPORU', PAD + 12, 38,
    'bold 26px "Segoe UI",Arial', '#f1f5f9');
  text(ctx, tarihStr(tarih), W - PAD, 42,
    '16px "Segoe UI",Arial', C.label, 'right');
  fillRect(ctx, 0, HEADER_H - 1, W, 1, C.divider);

  // ── Hat kartları ─────────────────────────────────────────────
  const hatRenkler = {
    'EXT-1': { accent: C.ext1, dim: C.ext1dim },
    'EXT-2': { accent: C.ext2, dim: C.ext2dim },
  };
  const cy0 = HEADER_H + PAD;

  if (hatlar.length === 0) {
    text(ctx, 'Veri bulunamadı', W / 2, cy0 + 80,
      '18px "Segoe UI",Arial', C.label, 'center');
  } else {
    hatlar.forEach((hat, i) => {
      const bx  = PAD + i * (kartiW + GAP);
      const r   = hatRenkler[hat] || { accent: '#64748b', dim: '#475569' };
      hatKartiCiz(ctx, bx, cy0, kartiW, hat, r.accent, r.dim,
        uretim[hat], hurda[hat], hizlar[hat] ?? null,
        baslangicBilgileri[hat] ?? null, urunBilgi[hat] ?? null);
    });
  }

  // ── BESLEME ──────────────────────────────────────────────────
  if (hammaddeler) {
    const by = cy0 + KART_H + PAD;
    beslemeKartiCiz(ctx, PAD, by, W - PAD * 2, hammaddeler);
  }

  // ── Alt bilgi ────────────────────────────────────────────────
  const fy = H - FOOTER_H;
  fillRect(ctx, 0, fy, W, FOOTER_H, '#0f172a');
  fillRect(ctx, 0, fy, W, 1, C.divider);
  text(ctx, 'CPS Üretim Takip Sistemi  ·  Capssun', W / 2, fy + 23,
    '12px "Segoe UI",Arial', C.label, 'center');

  return canvas.toBuffer('image/png');
}

module.exports = { gunlukGrafikOlustur };

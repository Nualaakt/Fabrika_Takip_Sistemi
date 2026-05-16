// ══════════════════════════════════════════════════════════════
//  grafik.js  –  Günlük üretim görsel kartı (PNG)
//
//  gunlukGrafikOlustur(uretimKayitlari, hurdaKayitlari, tarih, beslemeKayitlari)
//  → Buffer (image/png)
// ══════════════════════════════════════════════════════════════

const { createCanvas } = require('@napi-rs/canvas');
const { uretimOzetle, hurdaOzetle } = require('./rapor');

// ── Renk paleti (Excel formatına yakın) ──────────────────────
const C = {
  bg:          '#f0f4f8',
  white:       '#ffffff',
  hatExt1:     '#0d6efd',   // mavi  – EXT-1 başlığı
  hatExt2:     '#d9500b',   // turuncu – EXT-2 başlığı
  uretimHdr:   '#f5c518',   // sarı  – ÜRETİM başlık bg
  uretimHdrTx: '#4a3800',   // koyu sarı – ÜRETİM başlık yazı
  fireHdr:     '#d32f2f',   // kırmızı – FİRE başlık bg
  fireHdrTx:   '#ffffff',
  beslHdr:     '#2e7d32',   // yeşil  – BESLEME başlık bg
  beslHdrTx:   '#ffffff',
  rowLabel:    '#374151',
  rowValue:    '#111827',
  rowAlt:      '#f9fafb',
  border:      '#d1d5db',
  footer:      '#6b7280',
  recycleVal:  '#1565c0',   // mavi – recycle
  hurdaVal:    '#b71c1c',   // kırmızı – hurda
  fireOk:      '#1b5e20',
  fireWarn:    '#e65100',
  fireBad:     '#b71c1c',
  eksikBad:    '#b71c1c',
  eksikOk:     '#1b5e20',
  ekliVal:     '#e65100',
  evaColor:    '#1b5e20',
  poeColor:    '#e65100',
};

const pad2   = n => String(n).padStart(2, '0');
const fmtN   = (n, d = 0) => Number(n || 0).toLocaleString('tr-TR', {
  minimumFractionDigits: d, maximumFractionDigits: d,
});
function tarihStr(d) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// ── Yatay çizgi ───────────────────────────────────────────────
function hLine(ctx, x, y, w, color = C.border) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 1);
}

// ── Dikdörtgen (border-radius yok, sade) ─────────────────────
function fillRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// ── Tek satır metin (sola veya sağa hizalı) ───────────────────
function text(ctx, str, x, y, font, color, align = 'left') {
  ctx.font    = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
}

// ── Son 10 kayıttan hat hızı hesapla (m/dk) ──────────────────
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
    const hizDegerleri = son10.map(r => {
      const bas = new Date(r.BaslangicSaati);
      const bit = new Date(r.BitisSaati);
      const dk  = (bit - bas) / 60000;
      if (dk <= 0 || dk > 120) return null;  // 0 veya 2 saatten uzunsa durmuş demek
      return (r.MetreKg || 280) / dk;
    }).filter(Boolean);

    if (hizDegerleri.length === 0) { hizlar[hat] = null; continue; }

    // Ortalamanın %50'sinin altındakiler duruş kalıntısı — filtrele
    const ort = hizDegerleri.reduce((a, b) => a + b, 0) / hizDegerleri.length;
    const filtreli = hizDegerleri.filter(h => h >= ort * 0.5);
    hizlar[hat] = filtreli.reduce((a, b) => a + b, 0) / filtreli.length;
  }
  return hizlar;
}

// ── Hat bloğunu çiz ───────────────────────────────────────────
//  x, y : sol üst köşe
//  w     : toplam genişlik (ÜRETİM + FİRE yan yana)
//  u, hd : uretimOzetle[hat], hurdaOzetle[hat]
//  hatAdi: 'EXT-1' | 'EXT-2'
//  hatRenk: başlık arka plan rengi
//  hiz   : ortalama hız m/dk (veya null)
//
function hatBloguCiz(ctx, x, y, w, hatAdi, u, hd, hatRenk, hiz) {
  const HAT_H   = 40;  // hat başlık yüksekliği
  const SEC_H   = 32;  // ÜRETİM / FİRE bölüm başlık
  const ROW_H   = 38;  // her veri satırı
  const ROWS    = 5;   // 5 satır (her iki bölümde de)
  const HIZ_H   = 36;  // hat hızı satırı
  const colW    = Math.floor(w / 2);  // sol = ÜRETİM, sağ = FİRE

  // ── Hat başlık ───────────────────────────────────────────────
  fillRect(ctx, x, y, w, HAT_H, hatRenk);
  text(ctx, hatAdi, x + w / 2, y + 26, 'bold 22px "Segoe UI",Arial', '#ffffff', 'center');

  let cy = y + HAT_H;

  // ── Bölüm başlıkları (ÜRETİM | FİRE) ────────────────────────
  fillRect(ctx, x,        cy, colW, SEC_H, C.uretimHdr);
  fillRect(ctx, x + colW, cy, colW, SEC_H, C.fireHdr);
  text(ctx, 'ÜRETİM', x + colW / 2,       cy + 21, 'bold 14px "Segoe UI",Arial', C.uretimHdrTx, 'center');
  text(ctx, 'FİRE',   x + colW + colW / 2, cy + 21, 'bold 14px "Segoe UI",Arial', C.fireHdrTx,   'center');

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

  const fireRenk = fireOrani > 5 ? C.fireBad : fireOrani > 2.5 ? C.fireWarn : C.fireOk;

  // sol: ÜRETİM satırları  |  sağ: FİRE satırları
  const uretimSatir = [
    { etiket: 'Tam Ürün Sayısı',      deger: `${fmtN(tamUrun)} adet`,    renk: C.rowValue },
    { etiket: 'Ekli Ürün Sayısı',     deger: `${fmtN(ekliUrun)} adet`,   renk: ekliUrun > 0 ? C.ekliVal : C.rowValue },
    { etiket: 'Eksik Ürün Sayısı',    deger: `${fmtN(eksikUrun)} adet`,  renk: eksikUrun > 0 ? C.eksikBad : C.eksikOk },
    { etiket: 'Toplam Üretim Sayısı', deger: `${fmtN(toplam)} adet`,     renk: C.rowValue },
    { etiket: 'Toplam Üretim (m²)',   deger: `${fmtN(toplamM2, 1)} m²`,  renk: C.rowValue },
  ];

  const fireSatir = [
    { etiket: 'Recycle Ağırlığı',    deger: `${fmtN(recycleKg, 1)} kg`, renk: C.recycleVal },
    { etiket: 'Hurda Ağırlığı',      deger: `${fmtN(hurdaKg,   1)} kg`, renk: C.hurdaVal   },
    { etiket: 'Toplam Fire Ağırlığı',deger: `${fmtN(topFire,   1)} kg`, renk: C.rowValue   },
    { etiket: 'Fire Oranı',          deger: `%${fireOrani.toFixed(2)}`,  renk: fireRenk     },
    { etiket: '',                     deger: '',                          renk: C.rowValue   },
  ];

  for (let i = 0; i < ROWS; i++) {
    const ry = cy + i * ROW_H;
    const bg = i % 2 === 1 ? C.rowAlt : C.white;

    // sol hücre
    fillRect(ctx, x,        ry, colW, ROW_H, bg);
    text(ctx, uretimSatir[i].etiket, x + 10,              ry + ROW_H / 2 + 5, '13px "Segoe UI",Arial', C.rowLabel);
    text(ctx, uretimSatir[i].deger,  x + colW - 10,       ry + ROW_H / 2 + 6, 'bold 15px "Segoe UI",Arial', uretimSatir[i].renk, 'right');

    // sağ hücre
    fillRect(ctx, x + colW, ry, colW, ROW_H, bg);
    text(ctx, fireSatir[i].etiket, x + colW + 10,         ry + ROW_H / 2 + 5, '13px "Segoe UI",Arial', C.rowLabel);
    text(ctx, fireSatir[i].deger,  x + w - 10,            ry + ROW_H / 2 + 6, 'bold 15px "Segoe UI",Arial', fireSatir[i].renk, 'right');

    // orta dikey çizgi
    fillRect(ctx, x + colW, ry, 1, ROW_H, C.border);

    // alt yatay çizgi (son satır dahil)
    hLine(ctx, x, ry + ROW_H, w);
  }

  // ── Hat hızı satırı (tam genişlik) ──────────────────────────
  const hizY = cy + ROWS * ROW_H;
  fillRect(ctx, x, hizY, w, HIZ_H, '#f1f5f9');
  if (hiz != null) {
    text(ctx, 'Son 10 Ürün Ort. Hat Hızı', x + 12, hizY + HIZ_H / 2 + 5, '12px "Segoe UI",Arial', C.rowLabel);
    text(ctx, `${hiz.toFixed(2)} m/dk`, x + w - 12, hizY + HIZ_H / 2 + 6, 'bold 16px "Segoe UI",Arial', '#1e40af', 'right');
  } else {
    text(ctx, 'Hat Hızı: veri yok', x + w / 2, hizY + HIZ_H / 2 + 5, '12px "Segoe UI",Arial', C.footer, 'center');
  }
  hLine(ctx, x, hizY, w);
  hLine(ctx, x, hizY + HIZ_H, w);

  const blokH = HAT_H + SEC_H + ROWS * ROW_H + HIZ_H;

  // Blok çerçevesi
  ctx.strokeStyle = C.border;
  ctx.lineWidth   = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, blokH - 1);

  return blokH;
}

// ── BESLEME bölümünü çiz ──────────────────────────────────────
function beslemeBloguCiz(ctx, x, y, w, besleme, uretim) {
  const HDR_H = 34;
  const ROW_H = 40;

  // Başlık
  fillRect(ctx, x, y, w, HDR_H, C.beslHdr);
  text(ctx, 'BESLEME', x + w / 2, y + 22, 'bold 15px "Segoe UI",Arial', C.beslHdrTx, 'center');

  // Kalan üretim verilerinden gramaj (mod)
  // (uretim: { 'EXT-1': {...}, 'EXT-2': {...} })

  // EVA ve POE miktarlarını çek
  const eva = besleme.find(b => /EVA/i.test(b.SemiProductType));
  const poe = besleme.find(b => /POE/i.test(b.SemiProductType));
  const evaKg  = eva?.ToplamKg || 0;
  const poeKg  = poe?.ToplamKg || 0;
  const topKg  = evaKg + poeKg;
  // Saatlik: tam günlük tüketim / 24 saat
  const evaS   = evaKg > 0 ? Math.round(evaKg / 24) : 0;
  const poeS   = poeKg > 0 ? Math.round(poeKg / 24) : 0;

  const COLS = 5;
  const cw   = Math.floor(w / COLS);

  const basliklar = ['EVA Tüketimi', 'EVA Saatlik', 'POE Tüketimi', 'POE Saatlik', 'Toplam Üretilen'];
  const degerler  = [
    { d: `${fmtN(evaKg, 0)} kg`, r: C.evaColor },
    { d: `~${fmtN(evaS, 0)} kg/sa`, r: C.evaColor },
    { d: `${fmtN(poeKg, 0)} kg`, r: C.poeColor },
    { d: `~${fmtN(poeS, 0)} kg/sa`, r: C.poeColor },
    { d: `${fmtN(topKg, 0)} kg`, r: C.rowValue },
  ];

  const ry = y + HDR_H;
  fillRect(ctx, x, ry, w, ROW_H, C.white);

  for (let i = 0; i < COLS; i++) {
    const cx = x + i * cw;
    const cellW = i === COLS - 1 ? w - i * cw : cw;

    // Etiket
    text(ctx, basliklar[i], cx + cellW / 2, ry + 14, '11px "Segoe UI",Arial', C.rowLabel, 'center');
    // Değer
    text(ctx, degerler[i].d, cx + cellW / 2, ry + 30, 'bold 14px "Segoe UI",Arial', degerler[i].r, 'center');

    if (i > 0) fillRect(ctx, cx, ry, 1, ROW_H, C.border);
  }

  hLine(ctx, x, ry, w);
  hLine(ctx, x, ry + ROW_H, w);

  ctx.strokeStyle = C.border;
  ctx.lineWidth   = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, HDR_H + ROW_H - 1);

  return HDR_H + ROW_H;
}

// ── Ana fonksiyon ─────────────────────────────────────────────
function gunlukGrafikOlustur(uretimKayitlari, hurdaKayitlari, tarih, beslemeKayitlari = []) {
  // ── Layout sabitleri ────────────────────────────────────────
  const W        = 900;
  const PAD      = 16;
  const GAP      = 12;
  const HEADER_H = 60;
  const FOOTER_H = 32;

  const uretim = uretimOzetle(uretimKayitlari);
  const hurda  = hurdaOzetle(hurdaKayitlari);
  const hizlar = hatHizlariniHesapla(uretimKayitlari);
  const hatlar = Object.keys(uretim).sort();

  // Hat blok genişliği
  const sutunSayisi = hatlar.length || 1;
  const bloW = Math.floor((W - PAD * 2 - GAP * (sutunSayisi - 1)) / sutunSayisi);

  // Hat bloğu yüksekliği: HAT_H(40) + SEC_H(32) + ROWS*ROW_H(5*38) + HIZ_H(36)
  const BLO_H = 40 + 32 + 5 * 38 + 36;  // = 298

  // BESLEME verisi şu an hatalı — gösterme
  const beslemeVar = false;
  const BESL_H     = 0;

  const H = HEADER_H + PAD + BLO_H + PAD + BESL_H + FOOTER_H;

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // ── Arka plan ────────────────────────────────────────────────
  fillRect(ctx, 0, 0, W, H, C.bg);

  // ── Üst başlık ───────────────────────────────────────────────
  fillRect(ctx, 0, 0, W, HEADER_H, '#1e293b');
  text(ctx, 'GÜNLÜK ÜRETİM RAPORU', 24, 37, 'bold 24px "Segoe UI",Arial', '#f1f5f9');
  text(ctx, tarihStr(tarih), W - 24, 37, '17px "Segoe UI",Arial', '#94a3b8', 'right');

  // ── Hat blokları ─────────────────────────────────────────────
  const hatRenkler = { 'EXT-1': C.hatExt1, 'EXT-2': C.hatExt2 };
  const cy0 = HEADER_H + PAD;

  if (hatlar.length === 0) {
    text(ctx, 'Veri bulunamadı', W / 2, cy0 + 60, '18px "Segoe UI",Arial', C.rowLabel, 'center');
  } else {
    hatlar.forEach((hat, i) => {
      const bx = PAD + i * (bloW + GAP);
      hatBloguCiz(ctx, bx, cy0, bloW, hat, uretim[hat], hurda[hat],
        hatRenkler[hat] || '#555555', hizlar[hat] ?? null);
    });
  }

  // ── BESLEME bölümü ───────────────────────────────────────────
  if (beslemeVar) {
    const by = cy0 + BLO_H + PAD;
    beslemeBloguCiz(ctx, PAD, by, W - PAD * 2, beslemeKayitlari, uretim);
  }

  // ── Alt bilgi ────────────────────────────────────────────────
  const fy = H - FOOTER_H;
  fillRect(ctx, 0, fy, W, FOOTER_H, '#1e293b');
  text(ctx, 'CPS Üretim Takip Sistemi  ·  Capssun', W / 2, fy + 20,
    '13px "Segoe UI",Arial', '#64748b', 'center');

  return canvas.toBuffer('image/png');
}

module.exports = { gunlukGrafikOlustur };

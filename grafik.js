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
//  hiz          : m/dk (null ise gösterilmez)
//  baslangicInfo: { baslangicTarihi, gunSayisi } | null
//
function hatBloguCiz(ctx, x, y, w, hatAdi, u, hd, hatRenk, hiz, baslangicInfo) {
  const HAT_H  = 40;
  const INFO_H = 40;
  const SEC_H  = 32;
  const ROW_H  = 38;
  const ROWS   = 5;
  const colW   = Math.floor(w / 2);

  // ── Hat başlık ───────────────────────────────────────────────
  fillRect(ctx, x, y, w, HAT_H, hatRenk);
  text(ctx, hatAdi, x + w / 2, y + 26, 'bold 22px "Segoe UI",Arial', '#ffffff', 'center');

  // ── Bilgi satırı: Başlangıç | Gün | Hız ─────────────────────
  const iy = y + HAT_H;
  fillRect(ctx, x, iy, w, INFO_H, '#e8f0fe');

  const c1w = Math.floor(w * 0.42);
  const c2w = Math.floor(w * 0.25);
  const c3w = w - c1w - c2w;

  // Başlangıç tarihi
  const basTarihStr = baslangicInfo?.baslangicTarihi
    ? tarihStr(new Date(baslangicInfo.baslangicTarihi)) : '—';
  text(ctx, 'Ürt. Başlangıcı', x + 10, iy + 14, '10px "Segoe UI",Arial', C.footer);
  text(ctx, basTarihStr, x + 10, iy + 30, 'bold 13px "Segoe UI",Arial', C.rowValue);

  // Gün sayısı
  const gunStr = baslangicInfo?.gunSayisi != null ? `${baslangicInfo.gunSayisi} gün` : '—';
  fillRect(ctx, x + c1w, iy, 1, INFO_H, C.border);
  text(ctx, 'Çalışılan', x + c1w + c2w / 2, iy + 14, '10px "Segoe UI",Arial', C.footer, 'center');
  text(ctx, gunStr, x + c1w + c2w / 2, iy + 30, 'bold 15px "Segoe UI",Arial', '#1e40af', 'center');

  // Hat hızı
  const hizStr = hiz != null ? `${hiz.toFixed(2)} m/dk` : '—';
  fillRect(ctx, x + c1w + c2w, iy, 1, INFO_H, C.border);
  text(ctx, 'Orta Sil. Hızı', x + c1w + c2w + c3w / 2, iy + 14, '10px "Segoe UI",Arial', C.footer, 'center');
  text(ctx, hizStr, x + c1w + c2w + c3w / 2, iy + 30, 'bold 14px "Segoe UI",Arial', '#1e40af', 'center');

  hLine(ctx, x, iy + INFO_H, w);

  let cy = iy + INFO_H;

  // ── Bölüm başlıkları (ÜRETİM | FİRE) ────────────────────────
  fillRect(ctx, x,        cy, colW, SEC_H, C.uretimHdr);
  fillRect(ctx, x + colW, cy, colW, SEC_H, C.fireHdr);
  text(ctx, 'ÜRETİM', x + colW / 2,        cy + 21, 'bold 14px "Segoe UI",Arial', C.uretimHdrTx, 'center');
  text(ctx, 'FİRE',   x + colW + colW / 2,  cy + 21, 'bold 14px "Segoe UI",Arial', C.fireHdrTx,   'center');
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

  const uretimSatir = [
    { etiket: 'Tam Ürün Sayısı',      deger: `${fmtN(tamUrun)} adet`,   renk: C.rowValue },
    { etiket: 'Ekli Ürün Sayısı',     deger: `${fmtN(ekliUrun)} adet`,  renk: ekliUrun  > 0 ? C.ekliVal  : C.rowValue },
    { etiket: 'Eksik Ürün Sayısı',    deger: `${fmtN(eksikUrun)} adet`, renk: eksikUrun > 0 ? C.eksikBad : C.eksikOk },
    { etiket: 'Toplam Üretim Sayısı', deger: `${fmtN(toplam)} adet`,    renk: C.rowValue },
    { etiket: 'Toplam Üretim (m²)',   deger: `${fmtN(toplamM2, 1)} m²`, renk: C.rowValue },
  ];
  const fireSatir = [
    { etiket: 'Recycle Ağırlığı',     deger: `${fmtN(recycleKg, 1)} kg`, renk: C.recycleVal },
    { etiket: 'Hurda Ağırlığı',       deger: `${fmtN(hurdaKg,   1)} kg`, renk: C.hurdaVal   },
    { etiket: 'Toplam Fire Ağırlığı', deger: `${fmtN(topFire,   1)} kg`, renk: C.rowValue   },
    { etiket: 'Fire Oranı',           deger: `%${fireOrani.toFixed(2)}`,  renk: fireRenk     },
    { etiket: '',                      deger: '',                          renk: C.rowValue   },
  ];

  for (let i = 0; i < ROWS; i++) {
    const ry = cy + i * ROW_H;
    const bg = i % 2 === 1 ? C.rowAlt : C.white;
    fillRect(ctx, x,        ry, colW, ROW_H, bg);
    text(ctx, uretimSatir[i].etiket, x + 10,        ry + ROW_H / 2 + 5, '13px "Segoe UI",Arial', C.rowLabel);
    text(ctx, uretimSatir[i].deger,  x + colW - 10, ry + ROW_H / 2 + 6, 'bold 15px "Segoe UI",Arial', uretimSatir[i].renk, 'right');
    fillRect(ctx, x + colW, ry, colW, ROW_H, bg);
    text(ctx, fireSatir[i].etiket, x + colW + 10, ry + ROW_H / 2 + 5, '13px "Segoe UI",Arial', C.rowLabel);
    text(ctx, fireSatir[i].deger,  x + w - 10,    ry + ROW_H / 2 + 6, 'bold 15px "Segoe UI",Arial', fireSatir[i].renk, 'right');
    fillRect(ctx, x + colW, ry, 1, ROW_H, C.border);
    hLine(ctx, x, ry + ROW_H, w);
  }

  const blokH = HAT_H + INFO_H + SEC_H + ROWS * ROW_H;
  ctx.strokeStyle = C.border;
  ctx.lineWidth   = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, blokH - 1);
  return blokH;
}

// ── BESLEME bölümünü çiz (marka adları) ──────────────────────
function beslemeBloguCiz(ctx, x, y, w, hammaddeler) {
  const HDR_H = 34;
  const ROW_H = 40;

  fillRect(ctx, x, y, w, HDR_H, C.beslHdr);
  text(ctx, 'BESLEME', x + w / 2, y + 22, 'bold 15px "Segoe UI",Arial', C.beslHdrTx, 'center');

  const ry  = y + HDR_H;
  const cw  = Math.floor(w / 2);
  fillRect(ctx, x, ry, w, ROW_H, C.white);
  fillRect(ctx, x + cw, ry, 1, ROW_H, C.border);

  text(ctx, 'Kullanılan EVA Hammaddesi', x + cw / 2, ry + 13, '11px "Segoe UI",Arial', C.rowLabel, 'center');
  text(ctx, hammaddeler?.eva || '—', x + cw / 2, ry + 30, 'bold 14px "Segoe UI",Arial', C.evaColor, 'center');

  text(ctx, 'Kullanılan POE Hammaddesi', x + cw + cw / 2, ry + 13, '11px "Segoe UI",Arial', C.rowLabel, 'center');
  text(ctx, hammaddeler?.poe || '—', x + cw + cw / 2, ry + 30, 'bold 14px "Segoe UI",Arial', C.poeColor, 'center');

  hLine(ctx, x, ry, w);
  hLine(ctx, x, ry + ROW_H, w);
  ctx.strokeStyle = C.border;
  ctx.lineWidth   = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, HDR_H + ROW_H - 1);
  return HDR_H + ROW_H;
}

// ── Ana fonksiyon ─────────────────────────────────────────────
//  baslangicBilgileri : { 'EXT-1': { baslangicTarihi, gunSayisi }, 'EXT-2': ... } | {}
//  hammaddeler        : { eva: 'Hanwha', poe: 'DOW' } | null
//
function gunlukGrafikOlustur(uretimKayitlari, hurdaKayitlari, tarih,
                              baslangicBilgileri = {}, hammaddeler = null) {
  const W        = 900;
  const PAD      = 16;
  const GAP      = 12;
  const HEADER_H = 60;
  const FOOTER_H = 32;

  const uretim = uretimOzetle(uretimKayitlari);
  const hurda  = hurdaOzetle(hurdaKayitlari);
  const hizlar = hatHizlariniHesapla(uretimKayitlari);
  const hatlar = Object.keys(uretim).sort();

  const sutunSayisi = hatlar.length || 1;
  const bloW = Math.floor((W - PAD * 2 - GAP * (sutunSayisi - 1)) / sutunSayisi);

  // HAT_H(40) + INFO_H(40) + SEC_H(32) + ROWS*ROW_H(5*38)
  const BLO_H = 40 + 40 + 32 + 5 * 38;  // = 302

  const beslemeVar = hammaddeler != null;
  const BESL_H     = beslemeVar ? (34 + 40 + GAP) : 0;

  const H = HEADER_H + PAD + BLO_H + PAD + BESL_H + FOOTER_H;

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  fillRect(ctx, 0, 0, W, H, C.bg);

  fillRect(ctx, 0, 0, W, HEADER_H, '#1e293b');
  text(ctx, 'GÜNLÜK ÜRETİM RAPORU', 24, 37, 'bold 24px "Segoe UI",Arial', '#f1f5f9');
  text(ctx, tarihStr(tarih), W - 24, 37, '17px "Segoe UI",Arial', '#94a3b8', 'right');

  const hatRenkler = { 'EXT-1': C.hatExt1, 'EXT-2': C.hatExt2 };
  const cy0 = HEADER_H + PAD;

  if (hatlar.length === 0) {
    text(ctx, 'Veri bulunamadı', W / 2, cy0 + 60, '18px "Segoe UI",Arial', C.rowLabel, 'center');
  } else {
    hatlar.forEach((hat, i) => {
      const bx = PAD + i * (bloW + GAP);
      hatBloguCiz(ctx, bx, cy0, bloW, hat, uretim[hat], hurda[hat],
        hatRenkler[hat] || '#555555', hizlar[hat] ?? null, baslangicBilgileri[hat] ?? null);
    });
  }

  if (beslemeVar) {
    const by = cy0 + BLO_H + PAD;
    beslemeBloguCiz(ctx, PAD, by, W - PAD * 2, hammaddeler);
  }

  const fy = H - FOOTER_H;
  fillRect(ctx, 0, fy, W, FOOTER_H, '#1e293b');
  text(ctx, 'CPS Üretim Takip Sistemi  ·  Capssun', W / 2, fy + 20,
    '13px "Segoe UI",Arial', '#64748b', 'center');

  return canvas.toBuffer('image/png');
}

module.exports = { gunlukGrafikOlustur };

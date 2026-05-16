// ══════════════════════════════════════════════════════════════
//  grafik.js  –  Günlük üretim görsel kartı (PNG)
//
//  Kullanım:
//    const { gunlukGrafikOlustur } = require('./grafik');
//    const buf = gunlukGrafikOlustur(uretimKayitlari, hurdaKayitlari, new Date());
//    // buf → Buffer (image/png)
// ══════════════════════════════════════════════════════════════

const { createCanvas } = require('@napi-rs/canvas');
const { uretimOzetle, hurdaOzetle } = require('./rapor');

// ── Renk paleti ───────────────────────────────────────────────
const C = {
  bg:       '#0f172a',
  panel:    '#1e293b',
  border:   '#2d3f55',
  ext1:     '#0d9488',   // teal
  ext1dim:  '#0f4a46',
  ext2:     '#ea7c22',   // orange
  ext2dim:  '#5c3010',
  white:    '#f1f5f9',
  gray:     '#64748b',
  subgray:  '#94a3b8',
  green:    '#22c55e',
  yellow:   '#f59e0b',
  red:      '#ef4444',
  rowAlt:   '#162032',
};

// ── Yardımcılar ───────────────────────────────────────────────
const pad2   = n => String(n).padStart(2, '0');
const fmtSay = (n, d = 0) => Number(n || 0).toLocaleString('tr-TR', {
  minimumFractionDigits: d, maximumFractionDigits: d,
});

function tarihStr(d) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

// ── Hat sütunu çiz ────────────────────────────────────────────
function hatSutunuCiz(ctx, x, y, w, h, hatAdi, u, hd, renk, dimRenk) {
  const HEADER_H = 52;
  const FOOTER_H = 0;
  const METRIC_H = Math.floor((h - HEADER_H - FOOTER_H) / 6);

  // Sütun arka planı
  ctx.fillStyle = C.panel;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();

  // Hat başlığı
  ctx.fillStyle = renk;
  roundRect(ctx, x, y, w, HEADER_H, 14);
  ctx.fill();
  // Alt köşeleri düzelt
  ctx.fillRect(x, y + HEADER_H - 14, w, 14);

  // Hat adı
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(hatAdi, x + w / 2, y + 34);
  ctx.textAlign = 'left';

  // ── Metrik hesapla ─────────────────────────────────────────
  const tamUrun   = u?.tamUrun    || 0;
  const ekliUrun  = u?.ekliUrun   || 0;
  const eksikUrun = u?.eksikUrun  || 0;
  const toplam    = tamUrun + ekliUrun + eksikUrun;
  const toplamM2  = u?.toplamM2         || 0;
  const uretimKg  = u?.toplamUretimKg   || 0;
  const labFire   = u?.labFire          || 0;
  const hurdaKg   = hd?.hurda           || 0;
  const recycleKg = (hd?.recycle || 0) + (hd?.sarim || 0) + labFire;
  const topFire   = hurdaKg + recycleKg;
  const topGirdi  = uretimKg + topFire;
  const fireOrani = topGirdi > 0 ? (topFire / topGirdi) * 100 : 0;

  const metrikler = [
    {
      etiket: 'Toplam Ürün',
      deger:  `${fmtSay(toplam)} adet`,
      renk:   C.white,
    },
    {
      etiket: 'Ekli Ürün',
      deger:  `${fmtSay(ekliUrun)} adet`,
      renk:   ekliUrun > 0 ? C.yellow : C.subgray,
    },
    {
      etiket: 'Eksik Metraj',
      deger:  `${fmtSay(eksikUrun)} adet`,
      renk:   eksikUrun > 0 ? C.red : C.green,
    },
    {
      etiket: 'Toplam m²',
      deger:  `${fmtSay(toplamM2, 1)} m²`,
      renk:   C.white,
    },
    {
      etiket: 'Fire Miktarı',
      deger:  `${fmtSay(topFire, 1)} kg`,
      renk:   C.white,
    },
    {
      etiket: 'Fire Oranı',
      deger:  `%${fireOrani.toFixed(2)}`,
      renk:   fireOrani > 5 ? C.red : fireOrani > 2.5 ? C.yellow : C.green,
    },
  ];

  metrikler.forEach((m, i) => {
    const my = y + HEADER_H + i * METRIC_H;

    // Alternatif satır
    if (i % 2 === 1) {
      ctx.fillStyle = C.rowAlt;
      ctx.fillRect(x + 1, my, w - 2, METRIC_H);
    }

    // Etiket
    ctx.fillStyle = C.subgray;
    ctx.font = '14px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(m.etiket, x + 20, my + METRIC_H / 2 + 5);

    // Değer — sağa hizalı, büyük
    ctx.fillStyle = m.renk;
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(m.deger, x + w - 18, my + METRIC_H / 2 + 7);
    ctx.textAlign = 'left';

    // Alt çizgi (son satır hariç)
    if (i < metrikler.length - 1) {
      ctx.fillStyle = C.border;
      ctx.fillRect(x + 14, my + METRIC_H, w - 28, 1);
    }
  });

  // Sütun çerçeve çizgisi
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 14);
  ctx.stroke();
}

// ── Ana fonksiyon ─────────────────────────────────────────────
function gunlukGrafikOlustur(uretimKayitlari, hurdaKayitlari, tarih) {
  const W = 900, H = 530;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Arka plan
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // ── Üst başlık ─────────────────────────────────────────────
  const HEADER_H = 72;
  ctx.fillStyle = C.panel;
  ctx.fillRect(0, 0, W, HEADER_H);

  ctx.fillStyle = C.border;
  ctx.fillRect(0, HEADER_H, W, 1);

  // Başlık metni
  ctx.fillStyle = C.white;
  ctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('GÜNLÜK ÜRETİM RAPORU', 30, 44);

  // Tarih — sağ
  ctx.fillStyle = C.subgray;
  ctx.font = '17px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(tarihStr(tarih), W - 30, 44);
  ctx.textAlign = 'left';

  // ── Alt bilgi şeridi ────────────────────────────────────────
  const FOOTER_H = 36;
  const FOOTER_Y = H - FOOTER_H;
  ctx.fillStyle = C.panel;
  ctx.fillRect(0, FOOTER_Y, W, FOOTER_H);
  ctx.fillStyle = C.border;
  ctx.fillRect(0, FOOTER_Y, W, 1);
  ctx.fillStyle = C.gray;
  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CPS Üretim Takip Sistemi  ·  Capssun', W / 2, FOOTER_Y + 22);
  ctx.textAlign = 'left';

  // ── Hat verileri ────────────────────────────────────────────
  const uretim = uretimOzetle(uretimKayitlari);
  const hurda  = hurdaOzetle(hurdaKayitlari);

  const hatlar = Object.keys(uretim).sort();   // ['EXT-1', 'EXT-2']
  const hatRenkler = {
    'EXT-1': { ana: C.ext1, dim: C.ext1dim },
    'EXT-2': { ana: C.ext2, dim: C.ext2dim },
  };

  const PADDING   = 20;
  const SUTUN_GAP = 16;
  const CONTENT_Y = HEADER_H + PADDING;
  const CONTENT_H = FOOTER_Y - CONTENT_Y - PADDING;

  if (hatlar.length === 0) {
    ctx.fillStyle = C.subgray;
    ctx.font = '20px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Veri bulunamadı', W / 2, H / 2);
    return canvas.toBuffer('image/png');
  }

  const sutunSayisi = hatlar.length;
  const sutunW = Math.floor((W - PADDING * 2 - SUTUN_GAP * (sutunSayisi - 1)) / sutunSayisi);

  hatlar.forEach((hat, i) => {
    const sx = PADDING + i * (sutunW + SUTUN_GAP);
    const renkler = hatRenkler[hat] || { ana: C.subgray, dim: C.panel };
    hatSutunuCiz(ctx, sx, CONTENT_Y, sutunW, CONTENT_H, hat,
      uretim[hat], hurda[hat], renkler.ana, renkler.dim);
  });

  return canvas.toBuffer('image/png');
}

module.exports = { gunlukGrafikOlustur };

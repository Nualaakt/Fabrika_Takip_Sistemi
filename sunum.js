const pptxgen = require('pptxgenjs');

const pres = new pptxgen();
pres.layout  = 'LAYOUT_16x9';
pres.title   = 'CPS Üretim Takip Sistemi';
pres.author  = 'Capssun';

// ── Renkler ──────────────────────────────────────────────────
const C = {
  navy:    '1B2A4A',
  teal:    '0D9488',
  tealLt:  'CCFBF1',
  amber:   'F59E0B',
  amberLt: 'FEF3C7',
  white:   'FFFFFF',
  offW:    'F8FAFC',
  gray1:   '1E293B',
  gray2:   '475569',
  gray3:   '94A3B8',
  gray4:   'E2E8F0',
};

const FONT = 'Calibri';

// ── Yardımcılar ───────────────────────────────────────────────
function kart(slide, x, y, w, h, baslik, icerik, renkBar) {
  const bar = renkBar || C.teal;
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: C.white },
    shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.08 },
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w: 0.07, h,
    fill: { color: bar },
    line: { color: bar, width: 0 },
  });
  slide.addText(baslik, {
    x: x + 0.18, y: y + 0.1, w: w - 0.25, h: 0.3,
    fontFace: FONT, fontSize: 11, bold: true, color: C.gray1, margin: 0,
  });
  slide.addText(icerik, {
    x: x + 0.18, y: y + 0.42, w: w - 0.25, h: h - 0.52,
    fontFace: FONT, fontSize: 10, color: C.gray2, margin: 0,
  });
}

function baslikSlayt(slide) {
  slide.background = { color: C.navy };
}

function icerikBg(slide) {
  slide.background = { color: C.offW };
}

function slideBaslik(slide, metin) {
  slide.addText(metin, {
    x: 0.45, y: 0.22, w: 9.1, h: 0.5,
    fontFace: FONT, fontSize: 22, bold: true, color: C.navy, margin: 0,
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.45, y: 0.76, w: 1.1, h: 0.055,
    fill: { color: C.teal }, line: { color: C.teal, width: 0 },
  });
}

function etiket(slide, x, y, metin, renk) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w: metin.length * 0.085 + 0.2, h: 0.28,
    fill: { color: renk || C.teal }, rectRadius: 0.05,
  });
  slide.addText(metin, {
    x, y, w: metin.length * 0.085 + 0.2, h: 0.28,
    fontFace: FONT, fontSize: 9, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0,
  });
}

// ════════════════════════════════════════════════════════════════
// 1. KAPAK
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  baslikSlayt(s);

  // Sağ üst aksan
  s.addShape(pres.shapes.RECTANGLE, {
    x: 7.5, y: 0, w: 2.5, h: 5.625,
    fill: { color: C.teal, transparency: 85 }, line: { color: C.teal, width: 0 },
  });

  s.addText('CPS', {
    x: 0.6, y: 0.9, w: 6.5, h: 1.1,
    fontFace: FONT, fontSize: 72, bold: true, color: C.white, margin: 0,
  });
  s.addText('Üretim Takip Sistemi', {
    x: 0.6, y: 1.85, w: 6.8, h: 0.65,
    fontFace: FONT, fontSize: 30, color: C.tealLt, margin: 0,
  });
  s.addText('WhatsApp tabanlı akıllı üretim izleme ve bildirim platformu', {
    x: 0.6, y: 2.65, w: 6.8, h: 0.45,
    fontFace: FONT, fontSize: 14, color: C.gray3, margin: 0,
  });

  // Özellik rozetleri
  const rozet = [
    ['📊 Üretim Raporları', 0.6],
    ['🔔 Anlık Uyarılar',   2.4],
    ['🧪 Mikser Takibi',    4.2],
  ];
  rozet.forEach(([txt, x]) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 3.6, w: 1.65, h: 0.42,
      fill: { color: C.white, transparency: 85 }, line: { color: C.white, width: 1 },
    });
    s.addText(txt, {
      x, y: 3.6, w: 1.65, h: 0.42,
      fontFace: FONT, fontSize: 10, color: C.white, align: 'center', valign: 'middle', margin: 0,
    });
  });

  s.addText('Capssun  ·  2026', {
    x: 0.6, y: 4.9, w: 3, h: 0.3,
    fontFace: FONT, fontSize: 9, color: C.gray3, margin: 0,
  });
}

// ════════════════════════════════════════════════════════════════
// 2. SİSTEM MİMARİSİ
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  icerikBg(s);
  slideBaslik(s, 'Sistem Mimarisi');

  const kutular = [
    { x: 0.35, y: 1.05, renk: C.navy,  baslik: 'SQL Server',       alt: 'ProductionDB\n192.168.1.131\nÜretim · Mikser · Bakım\ntabloları' },
    { x: 2.75, y: 1.05, renk: C.teal,  baslik: 'Node.js Servisi',   alt: 'index.js\ndb.js · menu.js\nrapor.js · kullanicilar.js' },
    { x: 5.15, y: 1.05, renk: C.amber, baslik: 'whatsapp-web.js',   alt: 'WhatsApp Web\nPuppeteer / Chrome\nOturum kalıcı' },
    { x: 7.55, y: 1.05, renk: '7C3AED',baslik: 'Alıcılar',          alt: 'Admin · Üretim\nMikser · Bakım\nGruplar + Kayıtlılar' },
  ];

  kutular.forEach(({ x, y, renk, baslik, alt }) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 2.1, h: 2.1,
      fill: { color: C.white },
      shadow: { type: 'outer', color: '000000', blur: 10, offset: 3, angle: 135, opacity: 0.1 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 2.1, h: 0.38,
      fill: { color: renk }, line: { color: renk, width: 0 },
    });
    s.addText(baslik, {
      x: x + 0.12, y: y + 0.06, w: 1.88, h: 0.26,
      fontFace: FONT, fontSize: 11, bold: true, color: C.white, margin: 0,
    });
    s.addText(alt, {
      x: x + 0.12, y: y + 0.46, w: 1.88, h: 1.55,
      fontFace: FONT, fontSize: 9.5, color: C.gray2, margin: 0,
    });
    // Ok (son kutu hariç)
    if (x < 7.5) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: x + 2.12, y: y + 1.02, w: 0.6, h: 0.055,
        fill: { color: C.gray3 }, line: { color: C.gray3, width: 0 },
      });
    }
  });

  // Alt teknoloji rozetleri — 4 adet
  const altBadgeler = [
    { renk: '059669', baslik: 'PM2', alt: 'Süreç yöneticisi\nOtomatik restart & log', x: 0.35 },
    { renk: C.amber,  baslik: 'node-cron', alt: 'Zamanlayıcı\nVardiya · Günlük · Aylık', x: 2.75 },
    { renk: C.navy,   baslik: 'mssql',    alt: 'SQL Server sürücüsü\nBağlantı havuzu', x: 5.15 },
    { renk: '7C3AED', baslik: 'LLM API',  alt: 'Doğal Türkçe sorgulama\nSoru → SQL → Yanıt', x: 7.55 },
  ];
  altBadgeler.forEach(({ renk, baslik, alt, x }) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 3.5, w: 2.1, h: 0.9,
      fill: { color: C.white },
      shadow: { type: 'outer', color: '000000', blur: 6, offset: 2, angle: 135, opacity: 0.08 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 3.5, w: 0.07, h: 0.9,
      fill: { color: renk }, line: { color: renk, width: 0 },
    });
    s.addText(baslik, {
      x: x + 0.17, y: 3.58, w: 1.85, h: 0.26,
      fontFace: FONT, fontSize: 10, bold: true, color: C.gray1, margin: 0,
    });
    s.addText(alt, {
      x: x + 0.17, y: 3.86, w: 1.85, h: 0.45,
      fontFace: FONT, fontSize: 9, color: C.gray2, margin: 0,
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 3. ÜRETİM RAPORLARI
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  icerikBg(s);
  slideBaslik(s, 'Üretim Raporları');

  const raporlar = [
    { renk: C.navy,    emoji: '🕐', baslik: 'Vardiya Raporu',  saat: 'Her 8 saatte bir',     icerik: 'Hat bazlı üretim · m² · kg\nHurda & fire oranı\nBesleme tüketimi\nMikser durumu\nBir önceki vardiyayla karşılaştırma' },
    { renk: C.teal,    emoji: '📅', baslik: 'Günlük Rapor',    saat: 'Gece 00:05',           icerik: '3 vardiya özeti\nToplam üretim & hurda\nGünlük hat verimliliği\nMikser & stok özeti' },
    { renk: C.amber,   emoji: '📊', baslik: 'Haftalık Rapor',  saat: 'Her Pazartesi 08:10',  icerik: 'Hat bazlı haftalık üretim\nHurda trend analizi\nGraf ve karşılaştırmalı özet' },
    { renk: '7C3AED',  emoji: '📆', baslik: 'Aylık Rapor',     saat: 'Her ayın 1\'i 08:10',  icerik: 'Aylık toplam üretim\nHat performans özeti\nHurda & fire istatistiği' },
  ];

  raporlar.forEach(({ renk, emoji, baslik, saat, icerik }, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.4 + col * 4.8, y = 1.05 + row * 2.15;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.55, h: 1.95,
      fill: { color: C.white },
      shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.08 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.55, h: 0.42,
      fill: { color: renk }, line: { color: renk, width: 0 },
    });
    s.addText(`${emoji}  ${baslik}`, {
      x: x + 0.15, y: y + 0.07, w: 3.4, h: 0.28,
      fontFace: FONT, fontSize: 11.5, bold: true, color: C.white, margin: 0,
    });
    s.addText(saat, {
      x: x + 0.15, y: y + 0.5, w: 4.2, h: 0.22,
      fontFace: FONT, fontSize: 9, bold: true, color: renk, margin: 0,
    });
    s.addText(icerik, {
      x: x + 0.15, y: y + 0.75, w: 4.2, h: 1.1,
      fontFace: FONT, fontSize: 9.5, color: C.gray2, margin: 0,
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 4. ANLIK İZLEME & UYARILAR
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  icerikBg(s);
  slideBaslik(s, 'Anlık İzleme ve Uyarı Sistemi');

  s.addText('Her 5 dakikada bir veritabanı kontrol edilir. Eşik aşılınca otomatik bildirim gönderilir.', {
    x: 0.45, y: 0.9, w: 9.1, h: 0.3,
    fontFace: FONT, fontSize: 11, color: C.gray2, margin: 0,
  });

  const uyarilar = [
    { renk: 'DC2626', ikon: '🔴', baslik: 'Üretim Duruşu',      aciklama: '60 dakika boyunca yeni kayıt gelmezse admin\'e anlık uyarı gönderilir.', alici: 'Admin' },
    { renk: 'D97706', ikon: '🟠', baslik: 'Eksik Metraj',         aciklama: 'Bir vardiyadaki eksik ürün sayısı belirlenen eşiği (3) geçerse uyarı gönderilir.', alici: 'Admin + Üretim' },
    { renk: 'CA8A04', ikon: '🟡', baslik: 'Ek Ürün Artışı',       aciklama: 'Son 10 kayıtta 3\'ten fazla ek ürün tespit edilirse bildirim gönderilir.', alici: 'Admin + Üretim' },
    { renk: '7C3AED', ikon: '🟣', baslik: 'Düşük Stok',           aciklama: 'EPE POE < 10.000 kg veya EPE EVA < 6.000 kg olursa stok uyarısı gönderilir.', alici: 'Admin' },
    { renk: C.navy,  ikon: '🔴', baslik: 'Yeni Arıza Bildirimi', aciklama: 'Bkm-Ariza tablosuna yeni kayıt girildiğinde admin\'e anlık bildirim gider.', alici: 'Admin' },
  ];

  uyarilar.forEach(({ renk, ikon, baslik, aciklama, alici }, i) => {
    const y = 1.35 + i * 0.78;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.4, y, w: 9.2, h: 0.66,
      fill: { color: C.white },
      shadow: { type: 'outer', color: '000000', blur: 5, offset: 1, angle: 135, opacity: 0.07 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.4, y, w: 0.07, h: 0.66,
      fill: { color: renk }, line: { color: renk, width: 0 },
    });
    s.addText(`${ikon}  ${baslik}`, {
      x: 0.58, y: y + 0.07, w: 3.5, h: 0.25,
      fontFace: FONT, fontSize: 10.5, bold: true, color: C.gray1, margin: 0,
    });
    s.addText(aciklama, {
      x: 0.58, y: y + 0.34, w: 7.0, h: 0.24,
      fontFace: FONT, fontSize: 9, color: C.gray2, margin: 0,
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 8.1, y: y + 0.18, w: 1.4, h: 0.28,
      fill: { color: renk }, rectRadius: 0.04,
    });
    s.addText(alici, {
      x: 8.1, y: y + 0.18, w: 1.4, h: 0.28,
      fontFace: FONT, fontSize: 8.5, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0,
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 5. MİKSER TAKİP SİSTEMİ
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  icerikBg(s);
  slideBaslik(s, 'Mikser Takip Sistemi');

  const adimlar = [
    { renk: C.navy,   ikon: '🔵', no: '1', baslik: 'Yüklenmeye Başladı', sure: '—', icerik: 'Yeni MixerLoading\nkaydı tespit edilir.\nMikser hattı + lot no\nbildirilir.' },
    { renk: '7C3AED', ikon: '⚗️', no: '2', baslik: 'Dozajlama Başladı',  sure: 'Yükleme süresi',  icerik: 'DozajBaslangic\ndolunca tespit edilir.\nYükleme süresi\nhesaplanır.' },
    { renk: C.amber,  ikon: '✅', no: '3', baslik: 'Dozajlama Bitti',    sure: 'Dozaj süresi',    icerik: 'DozajBitis\ndolunca tespit edilir.\nDozajlama süresi\ngösterilir.' },
    { renk: 'D97706', ikon: '🟡', no: '4', baslik: 'Boşaltılmaya Başlandı', sure: '—',            icerik: 'MixerFeedTracking\'de\nilk silo kaydı\ngörünce bildirilir.' },
    { renk: '059669', ikon: '✅', no: '5', baslik: 'Boşaltıldı',         sure: 'Toplam süre',     icerik: '5 dk yeni silo\ngelmeyince tamamlandı\nsayılır. Silo detayları\nve toplam kg gösterilir.' },
  ];

  adimlar.forEach(({ renk, ikon, no, baslik, sure, icerik }, i) => {
    const x = 0.3 + i * 1.9;
    // Kutu
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.05, w: 1.75, h: 2.8,
      fill: { color: C.white },
      shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.09 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.05, w: 1.75, h: 0.42,
      fill: { color: renk }, line: { color: renk, width: 0 },
    });
    s.addText(`${no}. ${baslik}`, {
      x: x + 0.1, y: 1.08, w: 1.55, h: 0.36,
      fontFace: FONT, fontSize: 8.5, bold: true, color: C.white, margin: 0,
    });
    s.addText(ikon, {
      x: x + 0.55, y: 1.55, w: 0.65, h: 0.5,
      fontFace: FONT, fontSize: 24, align: 'center', margin: 0,
    });
    s.addText(icerik, {
      x: x + 0.1, y: 2.12, w: 1.55, h: 1.6,
      fontFace: FONT, fontSize: 8.5, color: C.gray2, margin: 0,
    });
    if (sure !== '—') {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: x + 0.08, y: 3.62, w: 1.59, h: 0.22,
        fill: { color: renk, transparency: 80 }, rectRadius: 0.03,
      });
      s.addText(`⏱ ${sure}`, {
        x: x + 0.08, y: 3.62, w: 1.59, h: 0.22,
        fontFace: FONT, fontSize: 8, color: renk, align: 'center', valign: 'middle', bold: true, margin: 0,
      });
    }
    // Ok (son hariç)
    if (i < adimlar.length - 1) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: x + 1.76, y: 2.42, w: 0.13, h: 0.05,
        fill: { color: C.gray3 }, line: { color: C.gray3, width: 0 },
      });
    }
  });

  s.addText('Tüm bildirimler Admin + Mikser rolündeki kullanıcılara/gruplara anlık iletilir.', {
    x: 0.4, y: 5.1, w: 9.2, h: 0.28,
    fontFace: FONT, fontSize: 9.5, color: C.gray2, italic: true, margin: 0,
  });
}

// ════════════════════════════════════════════════════════════════
// 6. HAZIR STOK TAKİBİ
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  icerikBg(s);
  slideBaslik(s, 'Hazır Stok Takibi');

  // Sol — Nasıl çalışır
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.4, y: 1.0, w: 4.5, h: 3.6,
    fill: { color: C.white },
    shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.08 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.4, y: 1.0, w: 4.5, h: 0.38,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 },
  });
  s.addText('Nasıl Hesaplanır?', {
    x: 0.56, y: 1.05, w: 4.2, h: 0.28,
    fontFace: FONT, fontSize: 11, bold: true, color: C.white, margin: 0,
  });
  // Açıklama satırları — individual addText (rich text arrays shift down in PPT rendering)
  s.addText("MixerFeedTracking tablosundaki siloların", {
    x: 0.56, y: 1.5, w: 4.2, h: 0.28,
    fontFace: FONT, fontSize: 10.5, color: C.gray1, margin: 0,
  });
  s.addText("Status = 'Bekliyor' olanlarının", {
    x: 0.56, y: 1.8, w: 4.2, h: 0.28,
    fontFace: FONT, fontSize: 10.5, bold: true, color: C.teal, margin: 0,
  });
  s.addText("SiloWeight toplamı alınır.", {
    x: 0.56, y: 2.1, w: 4.2, h: 0.28,
    fontFace: FONT, fontSize: 10.5, color: C.gray1, margin: 0,
  });
  const noktalar6 = [
    'Hangi silodan başlandığı önemli değil',
    'Tüketilen silolar otomatik düşülür',
    'Gerçek zamanlı kalan malzeme',
  ];
  noktalar6.forEach((m, i) => {
    s.addText('✓', {
      x: 0.56, y: 2.58 + i * 0.36, w: 0.3, h: 0.3,
      fontFace: FONT, fontSize: 11, bold: true, color: '059669', margin: 0,
    });
    s.addText(m, {
      x: 0.85, y: 2.58 + i * 0.36, w: 3.9, h: 0.3,
      fontFace: FONT, fontSize: 10.5, color: C.gray1, margin: 0,
    });
  });

  // Sağ — Örnek çıktı
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.1, y: 1.0, w: 4.5, h: 3.6,
    fill: { color: C.white },
    shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.08 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.1, y: 1.0, w: 4.5, h: 0.38,
    fill: { color: C.teal }, line: { color: C.teal, width: 0 },
  });
  s.addText('Sistem Çıktısı — //2', {
    x: 5.26, y: 1.05, w: 4.2, h: 0.28,
    fontFace: FONT, fontSize: 11, bold: true, color: C.white, margin: 0,
  });

  const satirlar = [
    ['🔵 Yüklü Mikserler', '', true],
    ['Mikser D', 'EPE EVA — 3.200 kg', false],
    ['Mikser A', 'EPE POE — 3.000 kg', false],
    ['', '', false],
    ['⏳ Yerdeki Mikserler (Hazır Stok)', '', true],
    ['EPE EVA', '12.800 kg  (4 mikser)', false],
    ['EPE POE', '18.000 kg  (6 mikser)', false],
  ];

  satirlar.forEach(([sol, sag, baslik], i) => {
    const y = 1.52 + i * 0.36;
    if (baslik) {
      s.addText(sol, {
        x: 5.26, y, w: 4.2, h: 0.3,
        fontFace: FONT, fontSize: 10, bold: true, color: C.navy, margin: 0,
      });
    } else if (sol) {
      s.addText(sol, { x: 5.36, y, w: 1.8, h: 0.28, fontFace: FONT, fontSize: 9.5, color: C.gray2, margin: 0 });
      s.addText(sag, { x: 7.2,  y, w: 2.2, h: 0.28, fontFace: FONT, fontSize: 9.5, color: C.gray1, bold: true, margin: 0 });
    }
  });
}

// ════════════════════════════════════════════════════════════════
// 7. BAKIM YÖNETİMİ
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  icerikBg(s);
  slideBaslik(s, 'Bakım Yönetimi');

  // Sol kart — Arıza İzleme
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.4, y: 1.0, w: 4.5, h: 4.0,
    fill: { color: C.white },
    shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.08 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.4, y: 1.0, w: 4.5, h: 0.42,
    fill: { color: 'DC2626' }, line: { color: 'DC2626', width: 0 },
  });
  s.addText('🔴  Arıza İzleme', {
    x: 0.56, y: 1.06, w: 4.2, h: 0.3,
    fontFace: FONT, fontSize: 12, bold: true, color: C.white, margin: 0,
  });
  s.addText([
    { text: 'Kaynak: ', options: { bold: true } },
    { text: 'Bkm-Ariza tablosu\n\n', options: {} },
    { text: '• ', options: { bold: true, color: 'DC2626' } },
    { text: 'Her 5 dakikada bir yeni arıza kontrolü\n', options: {} },
    { text: '• ', options: { bold: true, color: 'DC2626' } },
    { text: 'Yeni kayıt girilince admin\'e anlık bildirim\n', options: {} },
    { text: '• ', options: { bold: true, color: 'DC2626' } },
    { text: 'Arıza yeri, türü, öncelik\n', options: {} },
    { text: '• ', options: { bold: true, color: 'DC2626' } },
    { text: 'Atanan kişiler & durum\n\n', options: {} },
    { text: '//rapor → Bakım', options: { bold: true, color: C.teal } },
    { text: ' komutunda tüm açık\narızalar listelenir', options: {} },
  ], {
    x: 0.56, y: 1.52, w: 4.2, h: 3.3,
    fontFace: FONT, fontSize: 10.5, color: C.gray1, margin: 0,
  });

  // Sağ kart — Periyodik Bakım
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.1, y: 1.0, w: 4.5, h: 4.0,
    fill: { color: C.white },
    shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.08 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.1, y: 1.0, w: 4.5, h: 0.42,
    fill: { color: C.amber }, line: { color: C.amber, width: 0 },
  });
  s.addText('🟡  Periyodik Bakım Takibi', {
    x: 5.26, y: 1.06, w: 4.2, h: 0.3,
    fontFace: FONT, fontSize: 12, bold: true, color: C.white, margin: 0,
  });
  s.addText([
    { text: 'Kaynak: ', options: { bold: true } },
    { text: 'Bkm-Periyodik tablosu\n\n', options: {} },
    { text: '• ', options: { bold: true, color: C.amber } },
    { text: 'Sonraki 7 gün içindeki bakımlar\n', options: {} },
    { text: '• ', options: { bold: true, color: C.amber } },
    { text: 'Bakım adı, sorumlu, tarih\n', options: {} },
    { text: '• ', options: { bold: true, color: C.amber } },
    { text: 'Raporda önceden hatırlatma\n\n', options: {} },
    { text: 'Planlanan: ', options: { bold: true } },
    { text: 'vardiya raporlarına\nperiyodik bakım uyarısı eklenmesi', options: {} },
  ], {
    x: 5.26, y: 1.52, w: 4.2, h: 3.3,
    fontFace: FONT, fontSize: 10.5, color: C.gray1, margin: 0,
  });
}

// ════════════════════════════════════════════════════════════════
// 8. KULLANICI KAYIT SİSTEMİ
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  icerikBg(s);
  slideBaslik(s, 'Kullanıcı Kayıt ve Yönetim Sistemi');

  // Akış adımları
  const adimlar = [
    { renk: C.navy,  no: '1', baslik: 'Kayıt',          icerik: 'Kullanıcı\n//kayit yazar' },
    { renk: C.teal,  no: '2', baslik: 'Bilgi Toplama',   icerik: 'Bot ad-soyad\nve birim sorar' },
    { renk: C.amber, no: '3', baslik: 'Admin Bildirimi', icerik: 'Admin\'e talep\ngönderilir' },
    { renk: '7C3AED',no: '4', baslik: 'Onay / Red',      icerik: '//onayla veya\n//reddet' },
    { renk: '059669',no: '5', baslik: 'Aktif / Pasif',   icerik: 'Rapor alıp\nalmayacağı seçilir' },
  ];

  adimlar.forEach(({ renk, no, baslik, icerik }, i) => {
    const x = 0.3 + i * 1.9;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y: 1.05, w: 1.72, h: 1.7,
      fill: { color: C.white }, rectRadius: 0.08,
      shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.09 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.6, y: 1.12, w: 0.52, h: 0.52,
      fill: { color: renk }, line: { color: renk, width: 0 },
    });
    s.addText(no, {
      x: x + 0.6, y: 1.12, w: 0.52, h: 0.52,
      fontFace: FONT, fontSize: 22, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0,
    });
    s.addText(baslik, {
      x: x + 0.1, y: 1.7, w: 1.52, h: 0.28,
      fontFace: FONT, fontSize: 10, bold: true, color: C.gray1, align: 'center', margin: 0,
    });
    s.addText(icerik, {
      x: x + 0.1, y: 2.0, w: 1.52, h: 0.65,
      fontFace: FONT, fontSize: 9, color: C.gray2, align: 'center', margin: 0,
    });
    if (i < adimlar.length - 1) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: x + 1.74, y: 1.87, w: 0.14, h: 0.05,
        fill: { color: C.gray3 }, line: { color: C.gray3, width: 0 },
      });
    }
  });

  // Alt — admin komutları
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.4, y: 3.15, w: 9.2, h: 1.85,
    fill: { color: C.white },
    shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.07 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.4, y: 3.15, w: 0.07, h: 1.85,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 },
  });
  s.addText('Admin Komutları', {
    x: 0.58, y: 3.22, w: 8.8, h: 0.3,
    fontFace: FONT, fontSize: 11, bold: true, color: C.navy, margin: 0,
  });

  const komutlar = [
    ['//kayitlar',    'Onay bekleyen kayıt taleplerini listeler'],
    ['//onayla <ID>', 'Kullanıcıyı onaylar → aktif/pasif seçimi sorar'],
    ['//reddet <ID>', 'Kayıt talebini reddeder, kullanıcıya bildirim gider'],
    ['//alicilar',    'Tüm aktif alıcıları listeler (sabit + kayıtlı + gruplar)'],
  ];

  komutlar.forEach(([cmd, aciklama], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.58 + col * 4.6, y = 3.58 + row * 0.38;
    s.addText(cmd, { x, y, w: 1.8, h: 0.3, fontFace: 'Consolas', fontSize: 9.5, color: C.teal, bold: true, margin: 0 });
    s.addText(aciklama, { x: x + 1.85, y, w: 2.6, h: 0.3, fontFace: FONT, fontSize: 9.5, color: C.gray2, margin: 0 });
  });
}

// ════════════════════════════════════════════════════════════════
// 9. AKILLI SORGULAMA
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  icerikBg(s);
  slideBaslik(s, 'Akıllı Sorgulama (LLM Entegrasyonu)');

  s.addText('Admin ve yetkili kullanıcılar doğal Türkçe ile veri sorgulayabilir. Yapay zeka soruyu analiz edip veritabanı sorgusu oluşturur.', {
    x: 0.45, y: 0.88, w: 9.1, h: 0.35,
    fontFace: FONT, fontSize: 10.5, color: C.gray2, margin: 0,
  });

  // Örnek sorgular
  const ornekler = [
    { soru: 'Bu hafta kaç m² ürettik?',                   yanit: 'Haftalık üretim özeti (hat bazlı m², kg)' },
    { soru: '480 gram ürünlerin fire oranı nedir?',        yanit: '±5g toleransla 480g ürünlerin fire analizi' },
    { soru: '12 Mayıs\'tan itibaren üretim trendi nedir?', yanit: 'Belirtilen tarihten bugüne üretim trendi' },
    { soru: 'Dün Vardiya 2\'de en çok ne ürettik?',        yanit: 'Dünkü Vardiya 2 ürün tipi dağılımı' },
  ];

  ornekler.forEach(({ soru, yanit }, i) => {
    const y = 1.4 + i * 0.92;
    // Kullanıcı balonu
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.4, y, w: 5.5, h: 0.42,
      fill: { color: C.navy }, rectRadius: 0.08,
    });
    s.addText(`💬  ${soru}`, {
      x: 0.6, y: y + 0.07, w: 5.2, h: 0.28,
      fontFace: FONT, fontSize: 10, color: C.white, margin: 0,
    });
    // Bot yanıtı
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 4.1, y: y + 0.47, w: 5.5, h: 0.35,
      fill: { color: C.tealLt }, rectRadius: 0.08,
    });
    s.addText(`🤖  ${yanit}`, {
      x: 4.3, y: y + 0.53, w: 5.1, h: 0.24,
      fontFace: FONT, fontSize: 9.5, color: C.navy, margin: 0,
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 10. FAZ 1 ÖZETİ (bölüm ayırıcı)
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  baslikSlayt(s);

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 5.625,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 2.5, w: 10, h: 0.08,
    fill: { color: C.teal, transparency: 60 }, line: { color: C.teal, width: 0 },
  });

  s.addText('FAZ 1', {
    x: 0.6, y: 0.5, w: 8.8, h: 1.1,
    fontFace: FONT, fontSize: 80, bold: true, color: C.teal, margin: 0,
  });
  s.addText('Tamamlandı ✓', {
    x: 0.6, y: 1.55, w: 8.8, h: 0.6,
    fontFace: FONT, fontSize: 28, color: C.white, margin: 0,
  });

  const maddeler = [
    '📊 Vardiya · Günlük · Haftalık · Aylık Raporlar',
    '🔔 5 Anlık Uyarı Senaryosu    🧪 5 Adımlı Mikser Takibi',
    '🔧 Bakım İzleme    👥 Kullanıcı Kayıt Sistemi    🤖 LLM Sorgulama',
  ];
  maddeler.forEach((m, i) => {
    s.addText(m, {
      x: 0.6, y: 3.0 + i * 0.58, w: 8.8, h: 0.45,
      fontFace: FONT, fontSize: 11.5, color: C.gray3, margin: 0,
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 11. FAZ 2 BÖLÜM AYIRICI
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  baslikSlayt(s);

  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.5, y: 0, w: 3.5, h: 5.625,
    fill: { color: '7C3AED', transparency: 85 }, line: { color: '7C3AED', width: 0 },
  });

  s.addText('FAZ 2', {
    x: 0.6, y: 0.5, w: 8.8, h: 1.1,
    fontFace: FONT, fontSize: 80, bold: true, color: '7C3AED', margin: 0,
  });
  s.addText('Kalite · Yapay Zeka · Vizyon', {
    x: 0.6, y: 1.55, w: 7.5, h: 0.6,
    fontFace: FONT, fontSize: 26, color: C.white, margin: 0,
  });
  s.addText('Sistemin bir sonraki evresi: üretim kalitesini gerçek zamanlı izlemek,\nyapay zeka ile tahminsel kararlar almak ve tüm fabrikayı tek merkezden yönetmek.', {
    x: 0.6, y: 2.5, w: 8.8, h: 0.9,
    fontFace: FONT, fontSize: 12, color: C.gray3, margin: 0,
  });

  const etiketler = ['🔬 Kalite Sistemi', '📡 IoT Sensörler', '🤖 Claude API', '🏭 Fabrika Zekası'];
  etiketler.forEach((e, i) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.6 + i * 2.3, y: 3.85, w: 2.1, h: 0.45,
      fill: { color: '7C3AED', transparency: 70 }, line: { color: '7C3AED', width: 1 },
    });
    s.addText(e, {
      x: 0.6 + i * 2.3, y: 3.85, w: 2.1, h: 0.45,
      fontFace: FONT, fontSize: 9.5, color: C.white, align: 'center', valign: 'middle', margin: 0,
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 12. KALİTE SİSTEMİ — 4 MODÜL
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  icerikBg(s);
  slideBaslik(s, 'Faz 2 — Kalite Sistemi Entegrasyonu');

  s.addText('4 kalite tablosu gerçek zamanlı izlenecek. Olumsuz sonuçlar anında ilgili kişilere iletilecek.', {
    x: 0.45, y: 0.88, w: 9.1, h: 0.3,
    fontFace: FONT, fontSize: 10.5, color: C.gray2, margin: 0,
  });

  const moduller = [
    {
      renk: '7C3AED', baslik: 'Q_Mixer — Mikser Kalite Analizi',
      alanlar: ['AraNumuneSonuc', 'IndirmeSonuc', 'AnalizSonuc'],
      aciklama: 'Her mikser lotunun ara numune, indirme ve nihai analiz sonuçları takip edilir. AnalizSonuc olumsuzsa lot hattı durdurma kararı tetiklenebilir.',
    },
    {
      renk: C.teal, baslik: 'Q_Görünüş — Görsel Kontrol',
      alanlar: ['Genişlik (Baş/Orta/Son)', 'Kalınlık (3 nokta)', 'Birim Ağırlık (8 ölçüm)', 'SarımSonuGörselKontrol'],
      aciklama: 'Rulo başı görsel kontrol, genişlik sapması, kalınlık üniformitesi ve birim ağırlık uygunluğu izlenir. LimitDışı durumlar uyarı üretir.',
    },
    {
      renk: C.amber, baslik: 'Q_UMDR — Reoloji Testi',
      alanlar: ['TC10, TC90 (kürleme zamanı)', 'MH (max tork)', 'ML (min tork)', 'UygunlukDurumu'],
      aciklama: 'Malzeme reoloji karakteristikleri test edilir. TC10/TC90 ve tork değerleri spek dışına çıkarsa UygunlukDurumu "Uygun Değil" olarak kaydedilir.',
    },
    {
      renk: 'DC2626', baslik: 'Q_Shrink — Çekme Testi',
      alanlar: ['Cam: U1/K1/U2/K2 (% ölçüm)', 'Teflon: U1/K1/U2/K2 (% ölçüm)', 'CamUygunlukDurumu', 'TeflonUygunlukDurumu'],
      aciklama: 'Boylamasına ve enine çekme yüzdeleri cam ve teflon ortamda ölçülür. Her iki yönde uygunluk ayrı ayrı değerlendirilir.',
    },
  ];

  moduller.forEach(({ renk, baslik, alanlar, aciklama }, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.4 + col * 4.8, y = 1.25 + row * 2.1;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 4.55, h: 1.9,
      fill: { color: C.white },
      shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.08 },
    });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 4.55, h: 0.38,
      fill: { color: renk }, line: { color: renk, width: 0 },
    });
    s.addText(baslik, {
      x: x + 0.12, y: y + 0.06, w: 4.3, h: 0.26,
      fontFace: FONT, fontSize: 10, bold: true, color: C.white, margin: 0,
    });
    // Alanlar sol kolon
    alanlar.forEach((a, j) => {
      s.addText(`▸ ${a}`, {
        x: x + 0.12, y: y + 0.44 + j * 0.3, w: 2.1, h: 0.26,
        fontFace: FONT, fontSize: 8.5, color: renk, bold: true, margin: 0,
      });
    });
    // Açıklama sağ kolon
    s.addText(aciklama, {
      x: x + 2.3, y: y + 0.44, w: 2.12, h: 1.38,
      fontFace: FONT, fontSize: 8.5, color: C.gray2, margin: 0,
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 13. KALİTE UYARI AKIŞI
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  icerikBg(s);
  slideBaslik(s, 'Kalite Uyarı Akışı — Art Arda Olumsuz Sonuç');

  s.addText('Kalite tablolarında art arda 3 olumsuz sonuç tespit edildiğinde bildirim zinciri otomatik devreye girer.', {
    x: 0.45, y: 0.88, w: 9.1, h: 0.3,
    fontFace: FONT, fontSize: 10.5, color: C.gray2, margin: 0,
  });

  // Akış adımları
  const adimlar = [
    { renk: C.teal,    no: '1', baslik: 'Test Kaydı',         icerik: 'Kalite personeli\ntest sonucunu\nsisteme girer' },
    { renk: C.amber,   no: '2', baslik: 'Olumsuz Tespit',     icerik: '"Uygun Değil"\nsonucu\nkaydedildi' },
    { renk: 'D97706',  no: '3', baslik: 'Sayaç Artıyor',      icerik: 'Art arda olumsuz\nsayısı bot\ntarafından izlenir' },
    { renk: 'DC2626',  no: '4', baslik: '3. Olumsuz!',        icerik: 'Eşik aşıldı\nuyarı akışı\ntetiklendi' },
    { renk: '7C3AED',  no: '5', baslik: 'Vardiya Amiri',      icerik: '"Testleri kontrol\nedin" uyarısı\ngönderilir' },
    { renk: C.navy,    no: '6', baslik: 'Admin Bilgi',         icerik: '"Uyarı gönderildi"\nbilgilendirmesi\nadmine iletilir' },
  ];

  adimlar.forEach(({ renk, no, baslik, icerik }, i) => {
    const x = 0.3 + i * 1.58;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.35, w: 1.45, h: 2.4,
      fill: { color: C.white },
      shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.09 },
    });
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.35, w: 1.45, h: 0.38,
      fill: { color: renk }, line: { color: renk, width: 0 },
    });
    s.addText(`${no}`, {
      x: x + 0.55, y: 1.39, w: 0.35, h: 0.3,
      fontFace: FONT, fontSize: 14, bold: true, color: C.white, align: 'center', margin: 0,
    });
    s.addText(baslik, {
      x: x + 0.08, y: 1.82, w: 1.29, h: 0.32,
      fontFace: FONT, fontSize: 9.5, bold: true, color: C.gray1, align: 'center', margin: 0,
    });
    s.addText(icerik, {
      x: x + 0.08, y: 2.18, w: 1.29, h: 0.9,
      fontFace: FONT, fontSize: 8.5, color: C.gray2, align: 'center', margin: 0,
    });
    if (i < adimlar.length - 1) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: x + 1.46, y: 2.53, w: 0.11, h: 0.045,
        fill: { color: C.gray3 }, line: { color: C.gray3, width: 0 },
      });
    }
  });

  // Alt bilgi kutuları
  const bilgiler = [
    { renk: '7C3AED', baslik: 'Vardiya Amiri Mesajı', icerik: '"⚠️ Son 3 kalite testinde olumsuz sonuç\nvar. Lütfen testleri kontrol edin.\nLot: [XXX] · Hat: [EXT-1]"' },
    { renk: C.navy,   baslik: 'Admin Bilgilendirmesi', icerik: '"ℹ️ Kalite uyarısı gönderildi.\nVardiya Amiri bilgilendirildi.\n[Saat] · [Hat] · [Olumsuz sayısı: 3]"' },
  ];
  bilgiler.forEach(({ renk, baslik, icerik }, i) => {
    const x = 0.4 + i * 4.8;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 4.1, w: 4.55, h: 1.15,
      fill: { color: C.white },
      shadow: { type: 'outer', color: '000000', blur: 6, offset: 1, angle: 135, opacity: 0.07 },
    });
    s.addShape(pres.shapes.RECTANGLE, { x, y: 4.1, w: 0.07, h: 1.15,
      fill: { color: renk }, line: { color: renk, width: 0 },
    });
    s.addText(baslik, {
      x: x + 0.18, y: 4.16, w: 4.2, h: 0.26,
      fontFace: FONT, fontSize: 10, bold: true, color: renk, margin: 0,
    });
    s.addText(icerik, {
      x: x + 0.18, y: 4.44, w: 4.2, h: 0.74,
      fontFace: FONT, fontSize: 9, color: C.gray2, margin: 0,
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 14. ESP32 ÇEVRE İZLEME SİSTEMİ
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  icerikBg(s);
  slideBaslik(s, 'ESP32 Çevre İzleme Sistemi');

  s.addText('Fabrika genelinde sıcaklık ve nem takibi — depo, üretim hattı ve mikser odası anlık izlenir.', {
    x: 0.45, y: 0.88, w: 9.1, h: 0.3,
    fontFace: FONT, fontSize: 10.5, color: C.gray2, margin: 0,
  });

  // Sol — Mimari akış
  s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: 1.25, w: 4.3, h: 3.95,
    fill: { color: C.white },
    shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.08 },
  });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: 1.25, w: 4.3, h: 0.38,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 },
  });
  s.addText('📡  Mimari', {
    x: 0.52, y: 1.3, w: 4.0, h: 0.28,
    fontFace: FONT, fontSize: 11, bold: true, color: C.white, margin: 0,
  });

  // Akış adımları
  const mimariBasamak = [
    { renk: '059669', ikon: '🌡️', baslik: 'ESP32 Sensör', aciklama: 'DHT22 / SHT31 sensör\nSıcaklık + Nem ölçümü\nWi-Fi üzerinden gönderim' },
    { renk: C.teal,   ikon: '📶', baslik: 'Wi-Fi → SQL Server', aciklama: 'Her 60 sn\'de bir kayıt\nenvironmental_readings\ntablosuna yazılır' },
    { renk: C.navy,   ikon: '🤖', baslik: 'Node.js Bot', aciklama: 'Değerler eşik kontrolünden\ngeçirilir. Anormal veri\nveya kayıp tespit edilir.' },
    { renk: 'DC2626', ikon: '📲', baslik: 'WhatsApp Uyarı', aciklama: 'Eşik aşımı veya sensör\ncevap vermezse admin +\ndepo personeline bildirim' },
  ];

  mimariBasamak.forEach(({ renk, ikon, baslik, aciklama }, i) => {
    const y = 1.75 + i * 0.82;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.5, y, w: 0.42, h: 0.42,
      fill: { color: renk }, rectRadius: 0.05,
    });
    s.addText(ikon, {
      x: 0.5, y, w: 0.42, h: 0.42,
      fontFace: FONT, fontSize: 16, align: 'center', valign: 'middle', margin: 0,
    });
    s.addText(baslik, {
      x: 1.06, y: y + 0.02, w: 3.4, h: 0.24,
      fontFace: FONT, fontSize: 10, bold: true, color: C.gray1, margin: 0,
    });
    s.addText(aciklama, {
      x: 1.06, y: y + 0.27, w: 3.4, h: 0.48,
      fontFace: FONT, fontSize: 8.5, color: C.gray2, margin: 0,
    });
    if (i < mimariBasamak.length - 1) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.68, y: y + 0.44, w: 0.06, h: 0.36,
        fill: { color: C.gray3 }, line: { color: C.gray3, width: 0 },
      });
    }
  });

  // Sağ — Uyarı senaryoları + DB
  s.addShape(pres.shapes.RECTANGLE, { x: 4.85, y: 1.25, w: 4.75, h: 1.78,
    fill: { color: C.white },
    shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.08 },
  });
  s.addShape(pres.shapes.RECTANGLE, { x: 4.85, y: 1.25, w: 4.75, h: 0.38,
    fill: { color: C.teal }, line: { color: C.teal, width: 0 },
  });
  s.addText('⚠️  Uyarı Senaryoları', {
    x: 5.02, y: 1.3, w: 4.4, h: 0.28,
    fontFace: FONT, fontSize: 11, bold: true, color: C.white, margin: 0,
  });

  const uyarilar14 = [
    ['🌡️', 'Sıcaklık eşik aşımı', 'Depo > 35°C veya üretim hattı sapması'],
    ['💧', 'Nem eşik aşımı', 'Nem < %30 veya > %85 — malzeme riski'],
    ['📵', 'Sensör kayıp', '5 dk\'dır okuma gelmezse cihaz arıza uyarısı'],
  ];
  uyarilar14.forEach(([ikon, baslik, acik], i) => {
    s.addText(ikon + '  ' + baslik, {
      x: 5.02, y: 1.72 + i * 0.38, w: 2.1, h: 0.28,
      fontFace: FONT, fontSize: 9.5, bold: true, color: C.gray1, margin: 0,
    });
    s.addText(acik, {
      x: 7.18, y: 1.72 + i * 0.38, w: 2.3, h: 0.28,
      fontFace: FONT, fontSize: 8.5, color: C.gray2, margin: 0,
    });
  });

  // Sağ alt — DB tablo yapısı
  s.addShape(pres.shapes.RECTANGLE, { x: 4.85, y: 3.2, w: 4.75, h: 2.0,
    fill: { color: C.white },
    shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.08 },
  });
  s.addShape(pres.shapes.RECTANGLE, { x: 4.85, y: 3.2, w: 4.75, h: 0.38,
    fill: { color: '059669' }, line: { color: '059669', width: 0 },
  });
  s.addText('🗄️  environmental_readings', {
    x: 5.02, y: 3.25, w: 4.4, h: 0.28,
    fontFace: FONT, fontSize: 10.5, bold: true, color: C.white, margin: 0,
  });

  const kolonlar = [
    ['device_id', 'Sensör kimliği (ESP32 MAC)'],
    ['location',  'Konum: depo / hat-1 / mikser'],
    ['temperature','Sıcaklık (°C)'],
    ['humidity',  'Bağıl nem (%)'],
    ['recorded_at','Kayıt zamanı (DATETIME)'],
  ];
  kolonlar.forEach(([alan, acik], i) => {
    s.addText(alan, {
      x: 5.02, y: 3.68 + i * 0.29, w: 1.7, h: 0.24,
      fontFace: 'Consolas', fontSize: 8.5, color: C.teal, bold: true, margin: 0,
    });
    s.addText(acik, {
      x: 6.82, y: 3.68 + i * 0.29, w: 2.68, h: 0.24,
      fontFace: FONT, fontSize: 8.5, color: C.gray2, margin: 0,
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 15. TAHMİNSEL BAKIM — ESP32-S3 SENSÖR AĞI
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: '0F172A' };

  s.addText('Tahminsel Bakım', {
    x: 0.6, y: 0.28, w: 9, h: 0.7,
    fontFace: FONT, fontSize: 38, bold: true, color: C.white, margin: 0,
  });
  s.addText('ESP32-S3 · Akım · Su Akışı · Titreşim — Arızayı gelmeden önce gör', {
    x: 0.6, y: 0.95, w: 9, h: 0.38,
    fontFace: FONT, fontSize: 13, color: C.teal, margin: 0,
  });

  // 3 sensör kartı
  const sensorlar = [
    {
      renk: C.amber, ikon: '⚡', baslik: 'Akım Sensörü',
      aciklama: 'Motor veya pompanın çektiği akım\nnormale göre izlenir. Anormal artış\nveya düşüş → mekanik yük sorunu\nveya ön-arıza belirtisi.',
      ornekler: ['Normal: 4.2 A  ›  Uyarı: > 5.5 A', 'SCT-013 / INA219 sensörü', 'Kompresör, ekstruder, fan'],
    },
    {
      renk: C.teal, ikon: '💧', baslik: 'Su Akışı Sensörü',
      aciklama: 'Soğutma veya işlem suyu debisi\nanlık izlenir. Beklenen aralığın\ndışına çıkılırsa pompa/vana\nsorunu erken tespit edilir.',
      ornekler: ['Normal: 8 L/dk  ›  Uyarı: < 5 L/dk', 'YF-S201 / G1" flow sensörü', 'Soğutma hattı, mikser suyu'],
    },
    {
      renk: '7C3AED', ikon: '📳', baslik: 'Titreşim Sensörü',
      aciklama: 'Ekipman titreşim deseni sürekli\nkaydedilir. Rulman aşınması,\ndişli bozulması veya dengesizlik\nerken aşamada tespit edilir.',
      ornekler: ['FFT analizi ile frekans sapması', 'ADXL345 / MPU-6050', 'Motorlar, dişli kutuları, fanlar'],
    },
  ];

  sensorlar.forEach(({ renk, ikon, baslik, aciklama, ornekler }, i) => {
    const x = 0.35 + i * 3.22;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.52, w: 3.05, h: 3.78,
      fill: { color: '1E293B' }, line: { color: renk, width: 1 },
    });
    // İkon daire
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 1.1, y: 1.68, w: 0.85, h: 0.85,
      fill: { color: renk, transparency: 80 }, rectRadius: 0.1,
    });
    s.addText(ikon, { x: x + 1.1, y: 1.68, w: 0.85, h: 0.85,
      fontFace: FONT, fontSize: 28, align: 'center', valign: 'middle', margin: 0,
    });
    s.addText(baslik, {
      x: x + 0.15, y: 2.62, w: 2.75, h: 0.32,
      fontFace: FONT, fontSize: 11, bold: true, color: C.white, align: 'center', margin: 0,
    });
    s.addText(aciklama, {
      x: x + 0.15, y: 3.0, w: 2.75, h: 1.0,
      fontFace: FONT, fontSize: 8.8, color: '94A3B8', margin: 0,
    });
    // Örnek detaylar
    s.addShape(pres.shapes.RECTANGLE, { x: x + 0.12, y: 4.08, w: 2.81, h: 0.04,
      fill: { color: renk, transparency: 60 }, line: { color: renk, width: 0 },
    });
    ornekler.forEach((o, j) => {
      s.addText('▸  ' + o, {
        x: x + 0.15, y: 4.16 + j * 0.3, w: 2.75, h: 0.26,
        fontFace: FONT, fontSize: 8, color: renk, margin: 0,
      });
    });
  });

  // Alt bilgi
  s.addText('Anomali tespit edildiğinde → Bakım ekibine & admin\'e WhatsApp uyarısı · Bakım eylemi planlı gerçekleşir, acil duruş ortadan kalkar.', {
    x: 0.6, y: 5.27, w: 8.8, h: 0.28,
    fontFace: FONT, fontSize: 9, color: '475569', italic: true, margin: 0,
  });
}

// ════════════════════════════════════════════════════════════════
// (eski numara) CLAUDE API — YAPAY ZEKA KATMANI
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: '0F172A' };

  // Başlık
  s.addText('Claude API', {
    x: 0.6, y: 0.28, w: 9, h: 0.7,
    fontFace: FONT, fontSize: 38, bold: true, color: C.white, margin: 0,
  });
  s.addText('Sistemin Beyin Katmanı', {
    x: 0.6, y: 0.94, w: 9, h: 0.38,
    fontFace: FONT, fontSize: 17, color: C.teal, margin: 0,
  });

  // Sol — Şu an ne yapıyor
  s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 1.5, w: 4.4, h: 3.75,
    fill: { color: '1E293B' }, line: { color: C.teal, width: 1 },
  });
  s.addText('▸  Bugün Aktif', {
    x: 0.6, y: 1.62, w: 4.0, h: 0.32,
    fontFace: FONT, fontSize: 12, bold: true, color: C.teal, margin: 0,
  });
  const bugun = [
    ['🇹🇷', 'Türkçe Doğal Dil Anlama', 'Gramaj, tarih aralığı, vardiya sorguları doğal konuşma diliyle yapılır'],
    ['📅', 'Bağlam Çözümleme', '"itibari ile", "itibaren", "sonraki" gibi belirsiz ifadeler doğru yorumlanır'],
    ['🔍', 'Akıllı Veri Sorgulama', 'Soru → SQL → Yanıt dönüşümü otomatik; teknik bilgi gerekmez'],
    ['⚡', 'Anlık Yanıt', 'Üretim verisine anlık erişim; geçmiş trend analizleri saniyeler içinde'],
  ];
  bugun.forEach(([ikon, baslik, aciklama], i) => {
    s.addText(ikon, { x: 0.6, y: 2.1 + i * 0.78, w: 0.4, h: 0.35, fontFace: FONT, fontSize: 18, margin: 0 });
    s.addText(baslik, { x: 1.08, y: 2.1 + i * 0.78, w: 3.5, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: C.white, margin: 0 });
    s.addText(aciklama, { x: 1.08, y: 2.42 + i * 0.78, w: 3.5, h: 0.32, fontFace: FONT, fontSize: 8.5, color: '94A3B8', margin: 0 });
  });

  // Sağ — Gelecekte neler yapılabilir
  s.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 1.5, w: 4.4, h: 3.75,
    fill: { color: '1E293B' }, line: { color: '7C3AED', width: 1 },
  });
  s.addText('▸  Yatırımla Açılacak', {
    x: 5.4, y: 1.62, w: 4.0, h: 0.32,
    fontFace: FONT, fontSize: 12, bold: true, color: '7C3AED', margin: 0,
  });
  const gelecek = [
    ['🔮', 'Tahminsel Uyarılar', 'Geçmiş verilerden öğrenerek bir sonraki üretim sorununu önceden bildirir'],
    ['📊', 'Otomatik Rapor Yorumu', 'Vardiya sonu raporlarına doğal dil özeti ve öneriler otomatik eklenir'],
    ['🧪', 'Kalite Trend Analizi', 'Art arda olumsuz testlerde kök neden analizi yapıp öneri sunar'],
    ['🏭', 'Çok Birim Koordinasyonu', 'Üretim-kalite-bakım verilerini birleştirerek karar destek sistemi sunar'],
  ];
  gelecek.forEach(([ikon, baslik, aciklama], i) => {
    s.addText(ikon, { x: 5.4, y: 2.1 + i * 0.78, w: 0.4, h: 0.35, fontFace: FONT, fontSize: 18, margin: 0 });
    s.addText(baslik, { x: 5.88, y: 2.1 + i * 0.78, w: 3.5, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: C.white, margin: 0 });
    s.addText(aciklama, { x: 5.88, y: 2.42 + i * 0.78, w: 3.5, h: 0.32, fontFace: FONT, fontSize: 8.5, color: '94A3B8', margin: 0 });
  });
}

// ════════════════════════════════════════════════════════════════
// 15. PLATFORM VİZYONU — NELER YAPILABİLİR
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  icerikBg(s);
  slideBaslik(s, 'Platform Vizyonu — Neler Yapılabilir?');

  s.addText('Mevcut altyapı üzerine kurulacak özellikler — her biri bağımsız modül olarak devreye alınabilir.', {
    x: 0.45, y: 0.88, w: 9.1, h: 0.3,
    fontFace: FONT, fontSize: 10.5, color: C.gray2, margin: 0,
  });

  const ozellikler = [
    { renk: C.teal,   ikon: '📈', baslik: 'OEE Hesaplama',              icerik: 'Gerçek zamanlı\nplanlı/fiili üretim\nkarşılaştırması ve\nverimlililik skoru' },
    { renk: '7C3AED', ikon: '🔮', baslik: 'Tahminsel Bakım',             icerik: 'Arıza örüntülerinden\nöğrenerek ekipman\narızasını önceden\nhaber verir' },
    { renk: C.amber,  ikon: '⚡', baslik: 'Enerji Takibi',               icerik: 'Hat başına tüketim\niçgörüleri, vardiya\nbazlı enerji\noptimizasyonu' },
    { renk: 'DC2626', ikon: '📦', baslik: 'Sevkiyat & Depo',             icerik: 'DispatchTable\nentegrasyonu,\nstok seviye\nbildirimler' },
    { renk: C.navy,   ikon: '🖥️', baslik: 'Web Dashboard',              icerik: 'Tüm verilerin\ngörsel olarak\nizlendiği gerçek\nzamanlı panel' },
    { renk: '059669', ikon: '📱', baslik: 'Mobil Uygulama',              icerik: 'WhatsApp\'ın\nötesinde: iOS/Android\ndedike fabrika\nyönetim uygulaması' },
  ];

  ozellikler.forEach(({ renk, ikon, baslik, icerik }, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.3 + col * 3.22, y = 1.25 + row * 2.05;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 3.05, h: 1.88,
      fill: { color: C.white },
      shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.08 },
    });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 3.05, h: 0.4,
      fill: { color: renk }, line: { color: renk, width: 0 },
    });
    s.addText(`${ikon}  ${baslik}`, {
      x: x + 0.12, y: y + 0.07, w: 2.8, h: 0.26,
      fontFace: FONT, fontSize: 10, bold: true, color: C.white, margin: 0,
    });
    s.addText(icerik, {
      x: x + 0.12, y: y + 0.5, w: 2.8, h: 1.3,
      fontFace: FONT, fontSize: 9.5, color: C.gray2, margin: 0,
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 16. DEĞER ÖNERİSİ & YATIRIM GEREKÇESİ
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  icerikBg(s);
  slideBaslik(s, 'Değer Önerisi — Neden Yatırım?');

  // Büyük rakamlar
  const rakamlar = [
    { renk: C.teal,   rakam: '3',    birim: 'dakika',   aciklama: 'Vardiya raporu hazırlama\n(eskiden: elle 30-45 dk)' },
    { renk: '7C3AED', rakam: '5',    birim: 'dakika',   aciklama: 'Arıza/kalite uyarısına\nortalama tepki süresi' },
    { renk: C.amber,  rakam: '24/7', birim: '',          aciklama: 'Kesintisiz izleme;\ntatil, gece fark etmez' },
    { renk: 'DC2626', rakam: '0',    birim: 'kod bilgisi',aciklama: 'Türkçe konuşarak veri\nsorgulanabilir' },
  ];

  rakamlar.forEach(({ renk, rakam, birim, aciklama }, i) => {
    const x = 0.3 + i * 2.38;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.05, w: 2.22, h: 1.85,
      fill: { color: C.white },
      shadow: { type: 'outer', color: '000000', blur: 10, offset: 3, angle: 135, opacity: 0.1 },
    });
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.05, w: 2.22, h: 0.07,
      fill: { color: renk }, line: { color: renk, width: 0 },
    });
    s.addText(rakam, {
      x: x + 0.1, y: 1.18, w: 2.02, h: 0.75,
      fontFace: FONT, fontSize: 44, bold: true, color: renk, align: 'center', margin: 0,
    });
    s.addText(birim, {
      x: x + 0.1, y: 1.92, w: 2.02, h: 0.26,
      fontFace: FONT, fontSize: 9.5, color: C.gray3, align: 'center', margin: 0,
    });
    s.addText(aciklama, {
      x: x + 0.1, y: 2.2, w: 2.02, h: 0.55,
      fontFace: FONT, fontSize: 8.5, color: C.gray2, align: 'center', margin: 0,
    });
  });

  // Alt açıklama kartları
  const kartlar = [
    {
      renk: C.teal, baslik: '📊 Veri Tabanlı Karar Alma',
      icerik: 'Her vardiya sonrası otomatik üretilen raporlar, yöneticilerin sezgiyle değil somut veriyle karar almasını sağlar. Trend analizi, karşılaştırma ve sapma tespiti anlık yapılır.',
    },
    {
      renk: '7C3AED', baslik: '🔗 Genişletilebilir Altyapı',
      icerik: 'Modüler yapı sayesinde her yeni özellik (kalite, sevkiyat, OEE) mevcut sisteme eklenti olarak bağlanır. Yeni yatırım, sıfırdan başlamak değil; var olanı büyütmektir.',
    },
    {
      renk: C.amber, baslik: '🏭 Ölçeklenebilir Platform',
      icerik: 'Bugün tek fabrika için çalışan sistem, yarın tüm Capssun tesisleri için merkezi bir üretim zekası platformuna dönüşebilir.',
    },
  ];
  kartlar.forEach(({ renk, baslik, icerik }, i) => {
    const x = 0.4 + i * 3.2;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 3.25, w: 3.05, h: 2.05,
      fill: { color: C.white },
      shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.08 },
    });
    s.addShape(pres.shapes.RECTANGLE, { x, y: 3.25, w: 3.05, h: 0.07,
      fill: { color: renk }, line: { color: renk, width: 0 },
    });
    s.addText(baslik, {
      x: x + 0.15, y: 3.38, w: 2.75, h: 0.3,
      fontFace: FONT, fontSize: 10, bold: true, color: C.gray1, margin: 0,
    });
    s.addText(icerik, {
      x: x + 0.15, y: 3.72, w: 2.75, h: 1.45,
      fontFace: FONT, fontSize: 9, color: C.gray2, margin: 0,
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 17. GÜÇLÜ KAPANIŞ
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: '0A0F1E' };

  // Arka plan aksan şeritleri
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.12,
    fill: { color: C.teal }, line: { color: C.teal, width: 0 },
  });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.505, w: 10, h: 0.12,
    fill: { color: C.teal }, line: { color: C.teal, width: 0 },
  });

  s.addText('Bir Fabrika Zekası İnşa Ediyoruz.', {
    x: 0.6, y: 0.55, w: 8.8, h: 0.9,
    fontFace: FONT, fontSize: 32, bold: true, color: C.white, margin: 0,
  });
  s.addText('Faz 1 tamamlandı. Sistem bugün canlıda çalışıyor.', {
    x: 0.6, y: 1.42, w: 8.8, h: 0.42,
    fontFace: FONT, fontSize: 15, color: C.teal, margin: 0,
  });

  const noktalar = [
    ['📊', 'Vardiya raporları otomatik — insan hatası yok, gecikme yok'],
    ['🔔', 'Üretim durduğunda, kalite bozulduğunda, arıza çıktığında: anında haberdar'],
    ['🤖', 'Claude API ile Türkçe doğal dil sorguları — herkes veriye ulaşabilir'],
    ['📡', 'ESP32 IoT sensör ağı: sıcaklık/nem · akım · titreşim · su akışı izleme'],
    ['🚀', 'Faz 2 ile kalite sistemi, IoT sensörler ve tahminsel bakım entegrasyonu hazır'],
  ];
  noktalar.forEach(([ikon, metin], i) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y: 2.12 + i * 0.58, w: 0.06, h: 0.38,
      fill: { color: C.teal }, line: { color: C.teal, width: 0 },
    });
    s.addText(`${ikon}  ${metin}`, {
      x: 0.82, y: 2.14 + i * 0.58, w: 8.8, h: 0.38,
      fontFace: FONT, fontSize: 12, color: C.white, margin: 0,
    });
  });

  s.addText('Capssun  ·  CPS Üretim Takip Sistemi  ·  2026', {
    x: 0.6, y: 5.2, w: 8.8, h: 0.28,
    fontFace: FONT, fontSize: 9, color: '334155', margin: 0,
  });
}

// ════════════════════════════════════════════════════════════════
// ── (eski slide 10 yol haritası placeholder — silinmekte)
// ════════════════════════════════════════════════════════════════
if (false) {
  const s = pres.addSlide();
  icerikBg(s);
  slideBaslik(s, 'Yol Haritası — Planlanan Özellikler');

  const ozellikler = [
    {
      durum: 'Planlandı', renk: C.teal, ikon: '🔬',
      baslik: 'Kalite Sistemi',
      maddeler: ['Q_Mixer, Q_Gorunus, Q_UMDR tabloları\nbağlanacak', 'Art arda olumsuz test sonucu → vardiya\namirine uyarı + admin bilgilendirmesi'],
    },
    {
      durum: 'Planlandı', renk: '7C3AED', ikon: '👷',
      baslik: 'Vardiya Amiri Entegrasyonu',
      maddeler: ['Vardiya amirlerine özel rol', 'Kalite uyarıları doğrudan amire iletilir', 'Aktif vardiyaya göre doğru amire yönlendirme'],
    },
    {
      durum: 'Planlandı', renk: C.amber, ikon: '📦',
      baslik: 'Sevkiyat & Depo',
      maddeler: ['DispatchTable entegrasyonu', 'Stok seviye bildirimleri', 'Depo rolü için özel raporlar'],
    },
    {
      durum: 'Düşünülüyor', renk: C.gray2, ikon: '📉',
      baslik: 'Üretim Hedefleri',
      maddeler: ['Hat başına günlük m² hedefi', 'Vardiya bazlı hedef/gerçekleşme', 'Duruş süreleri analizi'],
    },
  ];

  ozellikler.forEach(({ durum, renk, ikon, baslik, maddeler }, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.4 + col * 4.8, y = 1.05 + row * 2.15;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.55, h: 1.95,
      fill: { color: C.white },
      shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 135, opacity: 0.08 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.55, h: 0.42,
      fill: { color: renk }, line: { color: renk, width: 0 },
    });
    s.addText(`${ikon}  ${baslik}`, {
      x: x + 0.15, y: y + 0.07, w: 3.4, h: 0.28,
      fontFace: FONT, fontSize: 11, bold: true, color: C.white, margin: 0,
    });
    s.addText(durum, {
      x: x + 3.3, y: y + 0.1, w: 1.1, h: 0.22,
      fontFace: FONT, fontSize: 8, color: C.white, align: 'right', italic: true, margin: 0,
    });
    maddeler.forEach((m, j) => {
      s.addText(`•  ${m}`, {
        x: x + 0.15, y: y + 0.52 + j * 0.47, w: 4.25, h: 0.42,
        fontFace: FONT, fontSize: 9.5, color: C.gray2, margin: 0,
      });
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 11. ÖZET
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  baslikSlayt(s);

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.35, h: 5.625,
    fill: { color: C.teal }, line: { color: C.teal, width: 0 },
  });

  s.addText('Ne İnşa Ettik?', {
    x: 0.65, y: 0.5, w: 9, h: 0.55,
    fontFace: FONT, fontSize: 28, bold: true, color: C.white, margin: 0,
  });

  const satirlar = [
    { renk: C.teal,   metin: '📊  4 Rapor Türü',              alt: 'Vardiya · Günlük · Haftalık · Aylık' },
    { renk: 'F59E0B', metin: '🔔  5 Uyarı Senaryosu',         alt: 'Duruş · Eksik metraj · Ek ürün · Düşük stok · Arıza' },
    { renk: '7C3AED', metin: '🧪  5 Adımlı Mikser Takibi',     alt: 'Yükleme → Dozaj → Boşaltma · Süre & kg bilgileri' },
    { renk: 'DC2626', metin: '🔧  Bakım İzleme',              alt: 'Anlık arıza bildirimi · Periyodik bakım takibi' },
    { renk: '059669', metin: '👥  Kullanıcı Kayıt Sistemi',    alt: 'Self-servis kayıt · Admin onay akışı · Rol bazlı dağıtım' },
    { renk: C.teal,   metin: '🤖  LLM Sorgulama',             alt: 'Doğal Türkçe ile tarih, gramaj, trend sorguları' },
  ];

  satirlar.forEach(({ renk, metin, alt }, i) => {
    const y = 1.3 + i * 0.68;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.65, y: y + 0.04, w: 0.06, h: 0.38,
      fill: { color: renk }, line: { color: renk, width: 0 },
    });
    s.addText(metin, {
      x: 0.85, y, w: 5, h: 0.32,
      fontFace: FONT, fontSize: 13, bold: true, color: C.white, margin: 0,
    });
    s.addText(alt, {
      x: 0.85, y: y + 0.33, w: 8.8, h: 0.28,
      fontFace: FONT, fontSize: 9.5, color: C.gray3, margin: 0,
    });
  });
}

// ── Kaydet ──────────────────────────────────────────────────
const cikis = 'C:\\Users\\ktalu\\OneDrive\\Masaüstü\\CPS_Uretim_Sistemi.pptx';
pres.writeFile({ fileName: cikis })
  .then(() => console.log('✅ Sunum oluşturuldu: ' + cikis))
  .catch(e => { console.error('❌ Hata:', e.message); process.exit(1); });

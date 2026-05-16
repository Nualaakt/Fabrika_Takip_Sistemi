// ══════════════════════════════════════════════════════════════
//  db.js  –  Veritabanı sorgu fonksiyonları
//
//  ÖNEMLİ: BaslangicSaati SQL'de `time` tipinde TR saati olarak
//  saklanıyor. Hiçbir UTC offset çevirisi gerekmez.
// ══════════════════════════════════════════════════════════════

const sql    = require('mssql');
const config = require('./config');

let pool = null;

async function baglan() {
  if (pool && pool.connected) return pool;
  // Önceki bağlantı kopuksa sıfırla
  if (pool) { try { await pool.close(); } catch (_) {} pool = null; }
  pool = await sql.connect(config.db);
  console.log('🗄️  SQL Server bağlantısı kuruldu.');
  return pool;
}

// DB'ye ulaşılabilir mi? (hızlı kontrol)
async function baglantiVarMi() {
  try {
    await baglan();
    return true;
  } catch {
    return false;
  }
}

// ── 1. ÜRETİM VERİLERİ ───────────────────────────────────────
//
//  baslangicSaat / bitisSaat → tam sayı saat (0, 8, 16, 24)
//  referansTarih             → vardiyaya ait üretim günü
//
//  Vardiya 1 (00-08): referansTarih = bugün, ama kayıtlar
//    bazen dünün tarihi ile de yazılmış olabilir.
//    Güvenli olmak için her zaman referansTarih + 1 gün öncesini de kontrol et.
//
async function uretimVerileriniGetir(tarih, baslangicSaat, bitisSaat) {
  const db = await baglan();

  // Tarih string'e çevir (YYYY-MM-DD) - JS Date timezone sorununu bypass et
  const d = new Date(tarih);
  const tarihStr = d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');

  const istek = db.request();
  istek.input('tarih',         sql.NVarChar, tarihStr);
  istek.input('saatBaslangic', sql.Int,      baslangicSaat);
  istek.input('saatBitis',     sql.Int,      bitisSaat);

  const sorgu = `
    SELECT
      UretimHatti,
      Vardiya,
      Urun,
      LotNumarasi,
      MetreKg,
      Gram,
      Genislik,
      EkDurumu,
      EksikMetraj,
      BaslangicSaati,
      BitisSaati,
      UretimTarihi
    FROM Production
    WHERE
      CONVERT(VARCHAR(10), UretimTarihi, 120) = @tarih
      AND DATEPART(HOUR, BitisSaati) >= @saatBaslangic
      AND DATEPART(HOUR, BitisSaati) < @saatBitis
    ORDER BY SiraNo ASC
  `;

  const sonuc = await istek.query(sorgu);
  return sonuc.recordset;
}

// ── 2. HURDA / RECYCLİNG VERİLERİ ────────────────────────────
//
//  KayitTarihi kolonu `date` tipinde olduğundan DATEPART(HOUR) kullanılamaz.
//  Hurda girişi vardiya bazında girildiğinden Production tablosundan okunan
//  Vardiya harfi (A/B/C/D) ile doğrudan eşleştiriyoruz.
//
//  ÇAĞRI: hurdaVerileriniGetir(tarih, vardiyaHarfi)
//
async function hurdaVerileriniGetir(tarih, dbVardiya) {
  const db = await baglan();

  const d2 = new Date(tarih);
  const tarihStr2 = d2.getFullYear() + '-' +
    String(d2.getMonth() + 1).padStart(2, '0') + '-' +
    String(d2.getDate()).padStart(2, '0');

  const istek = db.request();
  istek.input('tarih',    sql.NVarChar, tarihStr2);
  istek.input('vardiya',  sql.VarChar, dbVardiya);

  const sorgu = `
    SELECT
      Vardiya,
      Makine,
      EriyikHurda,
      HaliHurda,
      RuloHurda,
      HaliRecycle,
      RuloRecycle,
      Sarim,
      KayitTarihi
    FROM HurdaRecycleGirisi
    WHERE
      CONVERT(VARCHAR(10), KayitTarihi, 120) = @tarih
      AND Vardiya  = @vardiya
    ORDER BY KayitTarihi ASC
  `;

  const sonuc = await istek.query(sorgu);
  // DEBUG: DB'deki Vardiya değerlerini logla
  const vardiyaDegerleri = [...new Set(sonuc.recordset.map(r => r.Vardiya))];
  console.log(`   [DEBUG] Hurda sorgusu: tarih=${istek.parameters.tarih?.value}, dbVardiya=${istek.parameters.vardiya?.value}, kayıt=${sonuc.recordset.length}, DB'deki Vardiya değerleri:`, vardiyaDegerleri);
  return sonuc.recordset;
}

// ── 3. AKTİF MİKSERLER ───────────────────────────────────────
async function aktifMikserlerGetir() {
  const sorgu = `
    SELECT TOP 10
      ml.MixerLine,
      ml.SemiProductType,
      ml.LotNo,
      ml.TotalKg,
      ml.CreatedAt,
      feed.Status AS FeedStatus
    FROM MixerLoading ml
    OUTER APPLY (
      SELECT TOP 1 Status
      FROM MixerFeedTracking f
      WHERE f.MixerLotNo = ml.LotNo
      ORDER BY f.CreatedAt DESC, f.ID DESC
    ) feed
    WHERE (feed.Status IS NULL OR feed.Status = '')
    ORDER BY ml.CreatedAt DESC
  `;

  const sonuc = await (await baglan()).request().query(sorgu);
  return sonuc.recordset;
}

// ── 4. BEKLEYEN MİKSERLER (ürün tipi bazında toplu) ──────────
async function bekleyenMikserlerGetir() {
  const sorgu = `
    SELECT
      SemiProductType,
      SUM(SiloWeight)               AS ToplamKg,
      COUNT(DISTINCT MixerLotNo)    AS MikserSayisi
    FROM MixerFeedTracking
    WHERE Status = 'Bekliyor'
    GROUP BY SemiProductType
    ORDER BY SemiProductType
  `;

  const sonuc = await (await baglan()).request().query(sorgu);
  return sonuc.recordset;
}

module.exports = {
  baglan,
  baglantiVarMi,
  uretimVerileriniGetir,
  hurdaVerileriniGetir,
  aktifMikserlerGetir,
  bekleyenMikserlerGetir,
  gunlukUretimGetir,
  gunlukHurdaGetir,
  beslemeTuketimGetir,
  // Bakım
  acikArizalariGetir,
  sonArizaIdGetir,
  yeniArizalariGetir,
  yaklaşanBakimlariGetir,
  gunlukBeslemeTuketimGetir,
  haftalikUretimGetir,
  haftalikHurdaGetir,
  anlikUretimDurumuGetir,
  enSonKayitGetir,
  yeniKayitlarGetir,
  sonNKayitGetir,
  mikserYuklemelerGetir,
  bekleyenMikserSilolariGetir,
  lotSilolariGetir,
  gunlukMikserGetir,
  makineBaslangicBilgisiGetir,
  gunlukHammaddeMarkalariGetir,
};

// ── 5. GÜNLÜK ÜRETİM (tüm gün) ───────────────────────────────
async function gunlukUretimGetir(tarih) {
  const db = await baglan();
  const d3 = new Date(tarih);
  const tarihStr3 = d3.getFullYear() + '-' +
    String(d3.getMonth() + 1).padStart(2, '0') + '-' +
    String(d3.getDate()).padStart(2, '0');

  const istek = db.request();
  istek.input('tarih', sql.NVarChar, tarihStr3);

  const sorgu = `
    SELECT
      UretimHatti, Vardiya, Urun, LotNumarasi,
      MetreKg, Gram, Genislik, EkDurumu, EksikMetraj,
      BaslangicSaati, BitisSaati, UretimTarihi
    FROM Production
    WHERE CONVERT(VARCHAR(10), UretimTarihi, 120) = @tarih
    ORDER BY SiraNo ASC
  `;

  const sonuc = await istek.query(sorgu);
  return sonuc.recordset;
}

// ── 6. GÜNLÜK HURDA (tüm gün) ────────────────────────────────
//
//  KayitTarihi `date` tipi olduğundan tarih string ile karşılaştırıyoruz.
//  setUTCHours kullanmak UTC+3'te tarihi bir gün geriye kaydırıyordu.
//
async function gunlukHurdaGetir(tarih) {
  const db = await baglan();
  const d = new Date(tarih);
  const tarihStr = d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');

  const istek = db.request();
  istek.input('tarih', sql.NVarChar, tarihStr);

  const sorgu = `
    SELECT
      Vardiya, Makine, EriyikHurda, HaliHurda, RuloHurda,
      HaliRecycle, RuloRecycle, Sarim, KayitTarihi
    FROM HurdaRecycleGirisi
    WHERE CONVERT(VARCHAR(10), KayitTarihi, 120) = @tarih
    ORDER BY KayitTarihi ASC
  `;

  const sonuc = await istek.query(sorgu);
  return sonuc.recordset;
}


// ── 7. VARDİYA BESLEME TÜKETİMİ ─────────────────────────────
//
//  FeedStart UTC datetime olarak saklanıyor.
//  TR saat aralığını UTC'ye çevirip filtrele: UTC = TR - 3 saat
//
//  Vardiya 1 (00:00–08:00 TR) = 21:00 önceki gün – 05:00 UTC
//  Vardiya 2 (08:00–16:00 TR) = 05:00 – 13:00 UTC
//  Vardiya 3 (16:00–24:00 TR) = 13:00 – 21:00 UTC
//
async function beslemeTuketimGetir(tarih, baslangicSaatTR, bitisSaatTR) {
  const db = await baglan();

  const d   = new Date(tarih);
  const yil = d.getFullYear();
  const ay  = d.getMonth();
  const gun = d.getDate();

  // TR → UTC: Date.UTC negatif saat değerini otomatik önceki güne taşır
  const baslangicUTC = new Date(Date.UTC(yil, ay, gun, baslangicSaatTR - 3, 0, 0, 0));
  const bitisUTC     = new Date(Date.UTC(yil, ay, gun, bitisSaatTR     - 3, 0, 0, 0));

  const istek = db.request();
  istek.input('baslangic', sql.DateTime, baslangicUTC);
  istek.input('bitis',     sql.DateTime, bitisUTC);

  const sorgu = `
    SELECT
      SemiProductType,
      SUM(SiloWeight) AS ToplamKg,
      COUNT(*)        AS SiloSayisi
    FROM MixerFeedTracking
    WHERE
      Status IN ('Kullanildi', 'Kullanıldı')
      AND FeedStart >= @baslangic
      AND FeedStart <  @bitis
    GROUP BY SemiProductType
    ORDER BY SemiProductType
  `;

  const sonuc = await istek.query(sorgu);
  console.log(`   Besleme sorgusu: UTC ${baslangicUTC.toISOString()} – ${bitisUTC.toISOString()}, kayıt=${sonuc.recordset.length}`);
  return sonuc.recordset;
}

// ── 9. HAFTALIK ÜRETİM (tarih aralığı) ───────────────────────
async function haftalikUretimGetir(baslangicTarih, bitisTarih) {
  const db = await baglan();
  const istek = db.request();
  istek.input('baslangic', sql.DateTime, new Date(baslangicTarih));
  istek.input('bitis',     sql.DateTime, new Date(bitisTarih));

  const sorgu = `
    SELECT
      UretimHatti, Vardiya, Urun, LotNumarasi,
      MetreKg, Gram, Genislik, EkDurumu, EksikMetraj,
      BaslangicSaati, BitisSaati, UretimTarihi
    FROM Production
    WHERE UretimTarihi >= @baslangic AND UretimTarihi < @bitis
    ORDER BY UretimTarihi ASC, SiraNo ASC
  `;

  const sonuc = await istek.query(sorgu);
  return sonuc.recordset;
}

// ── 10. HAFTALIK HURDA (tarih aralığı) ───────────────────────
async function haftalikHurdaGetir(baslangicTarih, bitisTarih) {
  const db = await baglan();
  const istek = db.request();
  istek.input('baslangic', sql.DateTime, new Date(baslangicTarih));
  istek.input('bitis',     sql.DateTime, new Date(bitisTarih));

  const sorgu = `
    SELECT
      Vardiya, Makine, EriyikHurda, HaliHurda, RuloHurda,
      HaliRecycle, RuloRecycle, Sarim, KayitTarihi
    FROM HurdaRecycleGirisi
    WHERE KayitTarihi >= @baslangic AND KayitTarihi < @bitis
    ORDER BY KayitTarihi ASC
  `;

  const sonuc = await istek.query(sorgu);
  return sonuc.recordset;
}

// ── 8. GÜNLÜK BESLEME TÜKETİMİ ───────────────────────────────
//
//  Günlük: 00:00–24:00 TR = 21:00 önceki gün – 21:00 bugün UTC
//  FeedStart varsa tamamen tüketilmiş sayılır (FeedEnd veya Status kontrolü yok).
//
async function gunlukBeslemeTuketimGetir(tarih) {
  const db = await baglan();

  const d   = new Date(tarih);
  const yil = d.getFullYear();
  const ay  = d.getMonth();
  const gun = d.getDate();

  const baslangicUTC = new Date(Date.UTC(yil, ay, gun - 1, 21, 0, 0, 0));
  const bitisUTC     = new Date(Date.UTC(yil, ay, gun,     21, 0, 0, 0));

  const istek = db.request();
  istek.input('baslangic', sql.DateTime, baslangicUTC);
  istek.input('bitis',     sql.DateTime, bitisUTC);

  const sorgu = `
    SELECT
      SemiProductType,
      SUM(SiloWeight) AS ToplamKg,
      COUNT(*)        AS SiloSayisi
    FROM MixerFeedTracking
    WHERE
      FeedStart IS NOT NULL
      AND FeedStart >= @baslangic
      AND FeedStart <  @bitis
    GROUP BY SemiProductType
    ORDER BY SemiProductType
  `;

  const sonuc = await istek.query(sorgu);
  return sonuc.recordset;
}

// ── 15. MİKSER YÜKLEMELERİ (yüklendi + dozaj tespiti için) ──
async function mikserYuklemelerGetir() {
  const sorgu = `
    SELECT
      LotNo, MixerLine, SemiProductType, TotalKg, CreatedAt,
      DozajBaslangicSayac, DozajBitisSayac,
      CASE WHEN DozajBaslangicTarihi IS NOT NULL AND DozajBaslangicSaati IS NOT NULL
           THEN DATEADD(SECOND,
                  DATEDIFF(SECOND, 0, CAST(DozajBaslangicSaati AS TIME)),
                  CAST(DozajBaslangicTarihi AS DATETIME))
           ELSE NULL END AS DozajBaslangicZamani,
      CASE WHEN DozajBitisTarihi IS NOT NULL AND DozajBitisSaati IS NOT NULL
           THEN DATEADD(SECOND,
                  DATEDIFF(SECOND, 0, CAST(DozajBitisSaati AS TIME)),
                  CAST(DozajBitisTarihi AS DATETIME))
           ELSE NULL END AS DozajBitisZamani
    FROM MixerLoading
    ORDER BY CreatedAt DESC
  `;
  const sonuc = await (await baglan()).request().query(sorgu);
  return sonuc.recordset;
}

// ── 16. STATUS='Bekliyor' OLAN LOT'LARIN SİLO SAYISI ─────────
//
//  Boşaltma başlayınca MixerFeedTracking'e silo kayıtları 'Bekliyor'
//  statüsüyle girilir. Bu sorgu her lot için kaç silo olduğunu ve
//  son silo girişinin zamanını döndürür.
//
async function bekleyenMikserSilolariGetir() {
  const sorgu = `
    SELECT
      f.MixerLotNo,
      ml.MixerLine,
      ml.SemiProductType,
      COUNT(f.ID)      AS SiloSayisi,
      MAX(f.CreatedAt) AS SonSiloZamani
    FROM MixerFeedTracking f
    JOIN MixerLoading ml ON ml.LotNo = f.MixerLotNo
    WHERE f.Status = 'Bekliyor'
    GROUP BY f.MixerLotNo, ml.MixerLine, ml.SemiProductType
  `;
  const sonuc = await (await baglan()).request().query(sorgu);
  return sonuc.recordset;
}

// ── 17. BİR LOT'UN SİLO DETAYLARI ────────────────────────────
async function lotSilolariGetir(lotNo) {
  const db = await baglan();
  const istek = db.request();
  istek.input('lotNo', sql.NVarChar, lotNo);
  const sorgu = `
    SELECT SiloNo, SiloWeight, CreatedAt
    FROM MixerFeedTracking
    WHERE MixerLotNo = @lotNo AND Status = 'Bekliyor'
    ORDER BY SiloNo ASC
  `;
  const sonuc = await istek.query(sorgu);
  return sonuc.recordset;
}

// ── 12. EN SON KAYIT (izleme için) ───────────────────────────
//
//  DakikaFarki: SQL Server GETDATE() (sunucu yerel saati = TR) ile
//  son kaydın BitisSaati arasındaki fark.
//  Sunucu Türkiye'de olduğu sürece timezone karmaşası yok.
//
async function enSonKayitGetir() {
  const sorgu = `
    SELECT TOP 1
      SiraNo,
      UretimHatti,
      DATEDIFF(MINUTE,
        CAST(CAST(UretimTarihi AS DATE) AS DATETIME) + CAST(BitisSaati AS DATETIME),
        GETDATE()
      ) AS DakikaFarki
    FROM Production
    ORDER BY SiraNo DESC
  `;
  const sonuc = await (await baglan()).request().query(sorgu);
  return sonuc.recordset[0] || null;
}

// ── 13. BELİRLİ BİR SiraNo'DAN SONRA GELEN KAYITLAR ─────────
//
//  Anlık izleme için yeni üretim kayıtlarını tespit eder.
//  TOP 100 ile aşırı yük önlenir.
//
async function yeniKayitlarGetir(sonSiraNo) {
  const db = await baglan();
  const istek = db.request();
  istek.input('sonSiraNo', sql.Int, sonSiraNo || 0);
  const sorgu = `
    SELECT TOP 100
      SiraNo, UretimHatti, LotNumarasi, Urun, EkDurumu, EksikMetraj
    FROM Production
    WHERE SiraNo > @sonSiraNo
    ORDER BY SiraNo ASC
  `;
  const sonuc = await istek.query(sorgu);
  return sonuc.recordset;
}

// ── 14. SON N KAYIT (ek ürün rolling window için) ────────────
async function sonNKayitGetir(n) {
  const db = await baglan();
  const istek = db.request();
  istek.input('n', sql.Int, n || 10);
  const sorgu = `
    SELECT TOP (@n) SiraNo, UretimHatti, EkDurumu, EksikMetraj
    FROM Production
    ORDER BY SiraNo DESC
  `;
  const sonuc = await istek.query(sorgu);
  return sonuc.recordset;
}

// ── 11. ANLIK ÜRETİM DURUMU ──────────────────────────────────
//
//  Her hat için son 5 kaydı getirir (SiraNo'ya göre ters sıra).
//  Filtre: Gram > 100 (4.8 gibi hatalı girişleri eler)
//          Genislik 900-1400 arası (11311 gibi yazım hatalarını eler)
//
async function anlikUretimDurumuGetir() {
  const sorgu = `
    SELECT UretimHatti, Urun, LotNumarasi, Gram, Genislik, BitisSaati
    FROM (
      SELECT UretimHatti, Urun, LotNumarasi, Gram, Genislik, BitisSaati,
        ROW_NUMBER() OVER (PARTITION BY UretimHatti ORDER BY SiraNo DESC) AS rn
      FROM Production
      WHERE Gram > 100
        AND Genislik BETWEEN 900 AND 1400
    ) t
    WHERE rn <= 5
    ORDER BY UretimHatti, rn
  `;
  const sonuc = await (await baglan()).request().query(sorgu);
  return sonuc.recordset;
}

// ── 18. GÜNLÜK MİKSER YÜKLEMELERİ (belirli tarih) ───────────
async function gunlukMikserGetir(tarih) {
  const db = await baglan();
  const d = new Date(tarih);
  const tarihStr = d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');

  const istek = db.request();
  istek.input('tarih', sql.NVarChar, tarihStr);

  const sorgu = `
    SELECT MixerLine, SemiProductType, LotNo, TotalKg, CreatedAt
    FROM MixerLoading
    WHERE CONVERT(VARCHAR(10), CreatedAt, 120) = @tarih
    ORDER BY CreatedAt ASC
  `;

  const sonuc = await istek.query(sorgu);
  return sonuc.recordset;
}

// ── 19. MAKİNE BAŞLANGIÇ BİLGİSİ (8 saatlik boşluk mantığı) ──
async function makineBaslangicBilgisiGetir(hat) {
  const istek = (await baglan()).request();
  istek.input('hat', sql.NVarChar, hat);

  const sorgu = `
    SELECT TOP 500 UretimTarihi, BaslangicSaati, BitisSaati
    FROM Production
    WHERE UretimHatti = @hat AND BitisSaati IS NOT NULL
    ORDER BY UretimTarihi DESC, BitisSaati DESC
  `;
  const sonuc = await istek.query(sorgu);
  const kayitlar = sonuc.recordset;
  if (kayitlar.length === 0) return null;

  // Geriye doğru yürü, ilk 8+ saatlik boşluğu bul
  let baslangicTarihi = new Date(kayitlar[kayitlar.length - 1].UretimTarihi);
  for (let i = 0; i < kayitlar.length - 1; i++) {
    const suankiBas  = new Date(kayitlar[i].UretimTarihi);
    const oncekiBit  = new Date(kayitlar[i + 1].UretimTarihi);
    const suankiBasH = new Date(kayitlar[i].BaslangicSaati);
    const oncekiBitH = new Date(kayitlar[i + 1].BitisSaati);
    suankiBas.setUTCHours(suankiBasH.getUTCHours(), suankiBasH.getUTCMinutes(), 0, 0);
    oncekiBit.setUTCHours(oncekiBitH.getUTCHours(), oncekiBitH.getUTCMinutes(), 0, 0);
    if ((suankiBas - oncekiBit) / 3600000 >= 8) {
      baslangicTarihi = new Date(kayitlar[i].UretimTarihi);
      break;
    }
  }

  const bugun = new Date();
  const gunSayisi = Math.max(1, Math.floor((bugun - baslangicTarihi) / 86400000) + 1);
  return { baslangicTarihi, gunSayisi };
}

// ── 20. GÜNLÜK HAMMADDE MARKALARI ────────────────────────────
async function gunlukHammaddeMarkalariGetir(tarih) {
  const d = new Date(tarih);
  const tarihStr = d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
  const istek = (await baglan()).request();
  istek.input('tarih', sql.NVarChar, tarihStr);

  const sorgu = `
    SELECT Hammadde1, Hammadde2, Hammadde3, SemiProductType
    FROM MixerLoading
    WHERE CONVERT(VARCHAR(10), CreatedAt, 120) = @tarih
  `;
  const sonuc = await istek.query(sorgu);

  function markacikar(s) {
    if (!s || s.toUpperCase() === 'EKLEME') return null;
    const u = s.toUpperCase();
    if (u.includes('HANWHA')) return 'Hanwha';
    if (u.includes('DOW'))    return 'DOW';
    if (u.includes('LG'))     return 'LG';
    return null;
  }

  const evaMarka = new Set(), poeMarka = new Set();
  for (const r of sonuc.recordset) {
    const hedef = r.SemiProductType?.toUpperCase().includes('EVA') ? evaMarka : poeMarka;
    [r.Hammadde1, r.Hammadde2, r.Hammadde3].forEach(h => {
      const m = markacikar(h);
      if (m) hedef.add(m);
    });
  }

  return {
    eva: evaMarka.size > 0 ? [...evaMarka].join(' + ') : null,
    poe: poeMarka.size > 0 ? [...poeMarka].join(' + ') : null,
  };
}

// ── BAKIM: Açık arızalar ──────────────────────────────────────
async function acikArizalariGetir() {
  const sorgu = `
    SELECT
      [Arıza ID]         AS ArizaId,
      [Arıza Yeri]       AS ArizaYeri,
      [Arıza Türü]       AS ArizaTuru,
      [Öncelik]          AS Oncelik,
      [Çalışma Durumu]   AS CalismaDurumu,
      [İşlem Durumu]     AS IslemDurumu,
      [Başlangıç tarihi] AS BaslangicTarihi,
      [Atanan Kişiler]   AS AtananKisiler,
      [Açıklamalar]      AS Aciklamalar,
      [Oluşturma Tarihi] AS OlusturmaTarihi
    FROM [Bkm-Ariza]
    WHERE [Durum] = N'Açık'
    ORDER BY [Başlangıç tarihi] DESC
  `;
  const sonuc = await (await baglan()).request().query(sorgu);
  return sonuc.recordset;
}

async function sonArizaIdGetir() {
  const sorgu = `
    SELECT TOP 1
      [Arıza ID]         AS ArizaId,
      [Oluşturma Tarihi] AS OlusturmaTarihi
    FROM [Bkm-Ariza]
    ORDER BY [Oluşturma Tarihi] DESC
  `;
  const sonuc = await (await baglan()).request().query(sorgu);
  return sonuc.recordset[0] || null;
}

async function yeniArizalariGetir(sonZaman) {
  const db = await baglan();
  const istek = db.request();
  istek.input('sonZaman', sql.DateTime, sonZaman || new Date('2000-01-01'));
  const sorgu = `
    SELECT
      [Arıza ID]         AS ArizaId,
      [Arıza Yeri]       AS ArizaYeri,
      [Arıza Türü]       AS ArizaTuru,
      [Öncelik]          AS Oncelik,
      [Çalışma Durumu]   AS CalismaDurumu,
      [İşlem Durumu]     AS IslemDurumu,
      [Başlangıç tarihi] AS BaslangicTarihi,
      [Atanan Kişiler]   AS AtananKisiler,
      [Açıklamalar]      AS Aciklamalar,
      [Oluşturma Tarihi] AS OlusturmaTarihi
    FROM [Bkm-Ariza]
    WHERE [Oluşturma Tarihi] > @sonZaman
    ORDER BY [Oluşturma Tarihi] ASC
  `;
  const sonuc = await istek.query(sorgu);
  return sonuc.recordset;
}

async function yaklaşanBakimlariGetir(gunSayisi = 7) {
  const db = await baglan();
  const istek = db.request();
  istek.input('gunSayisi', sql.Int, gunSayisi);
  const sorgu = `
    SELECT
      [Bakım ID]              AS BakimId,
      [Ekipman]               AS Ekipman,
      [Bakım Türü]            AS BakimTuru,
      [Periyot Tipi]          AS PeriyotTipi,
      [Sonraki Bakım Tarihi]  AS SonrakiBakimTarihi,
      [Durum]                 AS Durum,
      [Sorumlu Kişiler]       AS SorumluKisiler,
      [Açıklama]              AS Aciklama
    FROM [Bkm-Periyodik]
    WHERE [Sonraki Bakım Tarihi] <= DATEADD(DAY, @gunSayisi, CAST(GETDATE() AS DATE))
    ORDER BY [Sonraki Bakım Tarihi] ASC
  `;
  const sonuc = await istek.query(sorgu);
  return sonuc.recordset;
}

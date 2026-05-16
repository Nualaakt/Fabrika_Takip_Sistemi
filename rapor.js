// ══════════════════════════════════════════════════════════════
//  rapor.js  –  Verileri WhatsApp mesajına dönüştürür
// ══════════════════════════════════════════════════════════════

const config = require('./config');

const pad2  = n => String(n).padStart(2, '0');
const saat  = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const tarih = d => `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()}`;

function hatAdi(dbDeger) {
  return config.hatlar[dbDeger] || dbDeger;
}

function sayi(n, ondalik = 0) {
  if (n == null || isNaN(n)) return '-';
  return Number(n).toLocaleString('tr-TR', {
    minimumFractionDigits: ondalik,
    maximumFractionDigits: ondalik,
  });
}

// ── Vardiya amiri: orta saate en yakın kaydın Vardiya alanından oku ──────────
//  Vardiya 1 (00-08) → ortaSaat = 4
//  Vardiya 2 (08-16) → ortaSaat = 12
//  Vardiya 3 (16-24) → ortaSaat = 20
const ORTA_SAAT = { 1: 4, 2: 12, 3: 20 };

function vardiyaAmiriBul(uretimKayitlari, vardiyaNo) {
  if (!uretimKayitlari || uretimKayitlari.length === 0) return '-';

  const ortaSaat = ORTA_SAAT[vardiyaNo];
  if (ortaSaat === undefined) return '-';

  let enYakinKayit = null;
  let enKucukFark  = Infinity;

  for (const r of uretimKayitlari) {
    // BaslangicSaati bir JS Date nesnesi olarak gelir (SQL time tipi)
    const kayitSaati = new Date(r.BitisSaati).getUTCHours();
    const fark = Math.abs(kayitSaati - ortaSaat);
    if (fark < enKucukFark) {
      enKucukFark  = fark;
      enYakinKayit = r;
    }
  }

  if (!enYakinKayit || !enYakinKayit.Vardiya) return '-';
  return config.vardiyaAmirleri[enYakinKayit.Vardiya] || enYakinKayit.Vardiya;
}

// ── Üretim verilerini hat bazında topla ───────────────────────
// m² = MetreKg (metre) × Genislik (mm) / 1000
function uretimOzetle(kayitlar) {
  const hatlar = {};

  for (const r of kayitlar) {
    const hat = hatAdi(r.UretimHatti);
    if (!hatlar[hat]) {
      hatlar[hat] = { tamUrun: 0, ekliUrun: 0, eksikUrun: 0, toplamM2: 0, toplamUretimKg: 0, labFire: 0 };
    }
    const h        = hatlar[hat];
    const metre    = r.MetreKg   || 0;
    const gram     = r.Gram      || 0;   // g/m²
    const genislik = r.Genislik  || 0;   // mm cinsinden
    const m2       = metre * genislik / 1000;

    const ekli  = r.EkDurumu && r.EkDurumu !== 'null';
    const eksik = r.EksikMetraj === true || r.EksikMetraj === 1;

    if (eksik)     h.eksikUrun++;
    else if (ekli) h.ekliUrun++;
    else           h.tamUrun++;

    h.toplamM2 += m2;

    // Teorik rulo ağırlığı (kg) = (g/m²)/1000 × (mm)/1000 × metre
    h.toplamUretimKg += (gram / 1000) * (genislik / 1000) * metre;

    // Lab firesi: her üründen 1 metre numune alınır
    // Lab fire (kg) = (Gram g/m²) / 1000 × (Genislik mm) / 1000
    const labFireKg = (gram / 1000) * (genislik / 1000);
    h.labFire += labFireKg;
  }

  return hatlar;
}

// ── Hurda/Recycle verilerini hat bazında topla ────────────────
function hurdaOzetle(kayitlar) {
  const hatlar = {};

  for (const r of kayitlar) {
    const hat = hatAdi(r.Makine);
    if (!hatlar[hat]) {
      hatlar[hat] = { hurda: 0, recycle: 0, sarim: 0 };
    }
    const h = hatlar[hat];
    h.hurda   += (r.EriyikHurda || 0) + (r.HaliHurda || 0) + (r.RuloHurda || 0);
    h.recycle += (r.HaliRecycle || 0) + (r.RuloRecycle || 0);
    h.sarim   += (r.Sarim || 0);
  }

  return hatlar;
}

// ── Anlık üretim: hat başına gramaj + genişlik tespiti ────────
//
//  kayitlar: [ { UretimHatti, Gram, Genislik }, ... ]
//  Sıra: ilk kayıt = en yeni (DB'den ROW_NUMBER ASC gelir, rn=1 en yeni)
//
//  Gramaj  → son 3 kaydın ortalamasını en yakın 10'a yuvarla
//  Genişlik → son 5 kaydın modu (en çok tekrarlayan, tam sayıya yuvarlanmış)
//
function anlikUretimOzetle(kayitlar) {
  const hatlar = {};
  for (const r of kayitlar) {
    const hat = hatAdi(r.UretimHatti);
    if (!hatlar[hat]) hatlar[hat] = { gramajlar: [], genislikler: [] };
    const gram = parseFloat(r.Gram);
    const gen  = parseFloat(r.Genislik);
    if (!isNaN(gram) && gram > 100)            hatlar[hat].gramajlar.push(gram);
    if (!isNaN(gen)  && gen > 900 && gen < 1400) hatlar[hat].genislikler.push(gen);
  }

  const sonuc = {};
  for (const [hat, d] of Object.entries(hatlar)) {
    // Gramaj: son 3'ün ortalaması → en yakın 10'a yuvarla
    const son3 = d.gramajlar.slice(0, 3);
    const gramajOrt = son3.length > 0
      ? son3.reduce((a, b) => a + b, 0) / son3.length
      : null;
    const gramaj = gramajOrt !== null ? Math.round(gramajOrt / 10) * 10 : null;

    // Genişlik: mod (en çok tekrarlayan, tam sayıya yuvarlayarak)
    const frekans = {};
    for (const g of d.genislikler) {
      const gr = Math.round(g);
      frekans[gr] = (frekans[gr] || 0) + 1;
    }
    const genislik = d.genislikler.length > 0
      ? parseInt(Object.entries(frekans).sort((a, b) => b[1] - a[1])[0][0])
      : null;

    sonuc[hat] = { gramaj, genislik };
  }
  return sonuc;
}

// ── ANA RAPOR MESAJI ──────────────────────────────────────────
function beslemeOzetle(kayitlar) {
  // [ { SemiProductType, ToplamKg, SiloSayisi } ] → direkt kullan
  return kayitlar || [];
}

function vardiyaRaporuOlustur({
  vardiyaNo, baslangic, bitis,
  uretimKayitlari, hurdaKayitlari,
  aktifMikserler, bekleyenMikserler,
  beslemeKayitlari = [],
  includeMikser = true,
  karsilastirma = null,
  stokTahmini   = null,
  anlikUretim   = null,
}) {
  const uretim = uretimOzetle(uretimKayitlari);
  const hurda  = hurdaOzetle(hurdaKayitlari);
  const simdi  = new Date();

  // Vardiya amiri: o vardiyaya ait kayıtlardaki orta saate en yakın Vardiya alanından
  const amir = vardiyaAmiriBul(uretimKayitlari, vardiyaNo);

  const s = [];

  // BAŞLIK
  s.push(`🏭 *VARDİYA ${vardiyaNo} RAPORU*`);
  s.push(`📅 ${tarih(baslangic)}  |  ⏰ ${saat(baslangic)} – ${saat(bitis)}`);
  s.push(`👷 Vardiya Amiri: ${amir}`);
  s.push(`📤 Gönderilme: ${saat(simdi)}`);
  s.push('─────────────────────────');

  // ANLIK ÜRETİM DURUMU
  if (anlikUretim && Object.keys(anlikUretim).length > 0) {
    s.push('🔴 *ANLIK ÜRETİM*');
    for (const hat of Object.keys(anlikUretim).sort()) {
      const a = anlikUretim[hat];
      const gramajStr  = a.gramaj   !== null ? `${a.gramaj}g`    : '?g';
      const genislikStr = a.genislik !== null ? `${a.genislik}mm` : '?mm';
      s.push(`   ${hat} : ${gramajStr}  ·  ${genislikStr}`);
    }
    s.push('─────────────────────────');
  }

  // ÜRETİM
  s.push('📦 *ÜRETİM ÖZETİ*');
  const hatListesi = Object.keys(uretim).sort();

  if (hatListesi.length === 0) {
    s.push('   Kayıt bulunamadı.');
  } else {
    let genelUrun = 0, genelM2 = 0;
    for (const hat of hatListesi) {
      const u = uretim[hat];
      const toplam = u.tamUrun + u.ekliUrun + u.eksikUrun;
      genelUrun += toplam;
      genelM2   += u.toplamM2;

      s.push(`\n   🔹 *${hat}*`);
      s.push(`   Tam Ürün        : ${sayi(u.tamUrun)} adet`);
      if (u.ekliUrun  > 0) s.push(`   Ekli Ürün       : ${sayi(u.ekliUrun)} adet`);
      if (u.eksikUrun > 0) s.push(`   ⚠️ Eksik Ürün   : ${sayi(u.eksikUrun)} adet`);
      s.push(`   Toplam Ürün     : ${sayi(toplam)} adet`);
      s.push(`   Toplam Üretim   : ${sayi(u.toplamM2, 1)} m²`);
    }
    if (hatListesi.length > 1) {
      s.push(`\n   📊 *Genel Toplam*`);
      s.push(`   Toplam Ürün     : ${sayi(genelUrun)} adet`);
      s.push(`   Toplam Üretim   : ${sayi(genelM2, 1)} m²`);
    }
  }

  s.push('─────────────────────────');

  // FİRE
  s.push('🔥 *FİRE BİLGİLERİ*');
  const hurdaHatlar = Object.keys(hurda).sort();
  const fireHatlar  = [...new Set([...hurdaHatlar, ...hatListesi])].sort();

  if (fireHatlar.length === 0) {
    s.push('   Kayıt bulunamadı.');
  } else {
    let gH = 0, gR = 0, gUretimKg = 0;
    for (const hat of fireHatlar) {
      const h        = hurda[hat] || { hurda: 0, recycle: 0, sarim: 0 };
      const labFire  = uretim[hat]?.labFire || 0;
      const uretimKg = uretim[hat]?.toplamUretimKg || 0;
      // Sarım ve lab firesi gösterilmez ama toplama dahil edilir
      const recycleGosterim = h.recycle + h.sarim + labFire;
      const topFire  = h.hurda + recycleGosterim;
      const topGirdi = uretimKg + topFire;
      const fireOrani = topGirdi > 0 ? (topFire / topGirdi) * 100 : 0;
      s.push(`\n   🔸 *${hat}*`);
      s.push(`   Hurda            : ${sayi(h.hurda, 1)} kg`);
      s.push(`   Recycle          : ${sayi(recycleGosterim, 1)} kg`);
      s.push(`   Toplam Fire      : ${sayi(topFire, 1)} kg`);
      s.push(`   Fire Oranı       : %${sayi(fireOrani, 2)}`);
      gH += h.hurda; gR += recycleGosterim; gUretimKg += uretimKg;
    }
    if (fireHatlar.length > 1) {
      const gTopFire  = gH + gR;
      const gTopGirdi = gUretimKg + gTopFire;
      const gFireOrani = gTopGirdi > 0 ? (gTopFire / gTopGirdi) * 100 : 0;
      s.push(`\n   📊 *Genel Toplam*`);
      s.push(`   Toplam Fire      : ${sayi(gTopFire, 1)} kg`);
      s.push(`   Fire Oranı       : %${sayi(gFireOrani, 2)}`);
    }
  }

  s.push('─────────────────────────');

  if (includeMikser) {
    s.push('🔧 *MİKSER DURUMU*');

    if (aktifMikserler.length > 0) {
      s.push(`\n   ✅ Şu an yüklü (${aktifMikserler.length}):`);
      for (const m of aktifMikserler) {
        s.push(`   • Mikser ${m.MixerLine} | ${m.SemiProductType} | ${sayi(m.TotalKg)} kg`);
      }
    } else {
      s.push('   ✅ Şu an yüklü: Yok');
    }

    if (bekleyenMikserler.length > 0) {
      s.push(`\n   ⏳ Hazır Stok:`);
      for (const m of bekleyenMikserler) {
        s.push(`   • ${m.SemiProductType}: ${sayi(m.ToplamKg)} kg (${m.MikserSayisi} mikser)`);
      }
    } else {
      s.push('   ⏳ Hazır Stok: Yok');
    }

    s.push('─────────────────────────');
  }

  // DÖNEM KARŞILAŞTIRMASI (admin only — karsilastirma geçilirse göster)
  if (karsilastirma) {
    const { etiket, onceki, simdiki } = karsilastirma;
    const m2Degisim = onceki.toplamM2 > 0
      ? ((simdiki.toplamM2 - onceki.toplamM2) / onceki.toplamM2 * 100)
      : null;
    const m2Ek      = m2Degisim !== null
      ? ` (${m2Degisim >= 0 ? '+' : ''}${sayi(m2Degisim, 1)}%)`
      : '';
    const fireFark  = simdiki.fireOrani - onceki.fireOrani;
    const fireTrend = fireFark <= 0 ? '↓ İyi' : '↑ Dikkat';

    s.push('📈 *DÖNEM KARŞILAŞTIRMASI*');
    s.push(`   Önceki      : ${etiket}`);
    s.push(`   m²          : ${sayi(onceki.toplamM2, 0)} → ${sayi(simdiki.toplamM2, 0)}${m2Ek}`);
    s.push(`   Fire Oranı  : %${sayi(onceki.fireOrani, 2)} → %${sayi(simdiki.fireOrani, 2)}  (${fireTrend})`);
    s.push('─────────────────────────');
  }

  // STOK TÜKENİM TAHMİNİ (admin only — stokTahmini geçilirse göster)
  if (stokTahmini && stokTahmini.length > 0) {
    s.push('🔮 *STOK TÜKENİM TAHMİNİ*');
    for (const st of stokTahmini) {
      const saatStr = st.kalanSaat !== null
        ? `≈ ${sayi(st.kalanSaat, 0)} saat`
        : 'hesaplanamadı';
      s.push(`   ${st.durum} ${st.urunTipi}: ${sayi(st.mevcutKg, 0)} kg  (${saatStr})`);
    }
    s.push('─────────────────────────');
  }

  s.push('_Capssun Takip Sistemi_');

  return s.join('\n');
}

// ── GÜNLÜK RAPOR MESAJI ───────────────────────────────────────
function gunlukRaporuOlustur({
  tarih, uretimKayitlari, hurdaKayitlari,
  aktifMikserler, bekleyenMikserler,
  beslemeKayitlari = [],
  includeMikser  = true,
  karsilastirma  = null,
}) {
  const uretim = uretimOzetle(uretimKayitlari);
  const hurda  = hurdaOzetle(hurdaKayitlari);
  const simdi  = new Date();

  const s = [];

  // BAŞLIK
  s.push(`🏭 *GÜNLÜK RAPOR*`);
  s.push(`📅 ${tarih instanceof Date ? `${pad2(tarih.getDate())}.${pad2(tarih.getMonth()+1)}.${tarih.getFullYear()}` : tarih}`);
  s.push(`📤 Gönderilme: ${saat(simdi)}`);
  s.push('─────────────────────────');

  // ÜRETİM
  s.push('📦 *ÜRETİM ÖZETİ*');
  const hatListesi = Object.keys(uretim).sort();

  if (hatListesi.length === 0) {
    s.push('   Kayıt bulunamadı.');
  } else {
    let genelUrun = 0, genelM2 = 0;
    for (const hat of hatListesi) {
      const u = uretim[hat];
      const toplam = u.tamUrun + u.ekliUrun + u.eksikUrun;
      genelUrun += toplam;
      genelM2   += u.toplamM2;
      s.push(`\n   🔹 *${hat}*`);
      s.push(`   Tam Ürün        : ${sayi(u.tamUrun)} adet`);
      if (u.ekliUrun  > 0) s.push(`   Ekli Ürün       : ${sayi(u.ekliUrun)} adet`);
      if (u.eksikUrun > 0) s.push(`   ⚠️ Eksik Ürün   : ${sayi(u.eksikUrun)} adet`);
      s.push(`   Toplam Ürün     : ${sayi(toplam)} adet`);
      s.push(`   Toplam Üretim   : ${sayi(u.toplamM2, 1)} m²`);
    }
    s.push(`\n   📊 *Genel Toplam*`);
    s.push(`   Toplam Ürün     : ${sayi(genelUrun)} adet`);
    s.push(`   Toplam Üretim   : ${sayi(genelM2, 1)} m²`);
  }

  s.push('─────────────────────────');

  // FİRE
  s.push('🔥 *FİRE BİLGİLERİ*');
  const hurdaHatlar = Object.keys(hurda).sort();
  const fireHatlar  = [...new Set([...hurdaHatlar, ...hatListesi])].sort();

  if (fireHatlar.length === 0) {
    s.push('   Kayıt bulunamadı.');
  } else {
    let gH = 0, gR = 0, gUretimKg = 0;
    for (const hat of fireHatlar) {
      const h        = hurda[hat] || { hurda: 0, recycle: 0, sarim: 0 };
      const labFire  = uretim[hat]?.labFire || 0;
      const uretimKg = uretim[hat]?.toplamUretimKg || 0;
      const recycleGosterim = h.recycle + h.sarim + labFire;
      const topFire  = h.hurda + recycleGosterim;
      const topGirdi = uretimKg + topFire;
      const fireOrani = topGirdi > 0 ? (topFire / topGirdi) * 100 : 0;
      s.push(`\n   🔸 *${hat}*`);
      s.push(`   Hurda            : ${sayi(h.hurda, 1)} kg`);
      s.push(`   Recycle          : ${sayi(recycleGosterim, 1)} kg`);
      s.push(`   Toplam Fire      : ${sayi(topFire, 1)} kg`);
      s.push(`   Fire Oranı       : %${sayi(fireOrani, 2)}`);
      gH += h.hurda; gR += recycleGosterim; gUretimKg += uretimKg;
    }
    const gTopFire  = gH + gR;
    const gTopGirdi = gUretimKg + gTopFire;
    const gFireOrani = gTopGirdi > 0 ? (gTopFire / gTopGirdi) * 100 : 0;
    s.push(`\n   📊 *Genel Toplam*`);
    s.push(`   Toplam Fire      : ${sayi(gTopFire, 1)} kg`);
    s.push(`   Fire Oranı       : %${sayi(gFireOrani, 2)}`);
  }

  s.push('─────────────────────────');

  if (includeMikser) {
    s.push('🔧 *MİKSER DURUMU*');

    if (aktifMikserler.length > 0) {
      s.push(`\n   ✅ Şu an yüklü (${aktifMikserler.length}):`);
      for (const m of aktifMikserler) {
        s.push(`   • Mikser ${m.MixerLine} | ${m.SemiProductType} | ${sayi(m.TotalKg)} kg`);
      }
    } else {
      s.push('   ✅ Şu an yüklü: Yok');
    }

    if (bekleyenMikserler.length > 0) {
      s.push(`\n   ⏳ Hazır Stok:`);
      for (const m of bekleyenMikserler) {
        s.push(`   • ${m.SemiProductType}: ${sayi(m.ToplamKg)} kg (${m.MikserSayisi} mikser)`);
      }
    } else {
      s.push('   ⏳ Hazır Stok: Yok');
    }

    s.push('─────────────────────────');
  }

  // DÖNEM KARŞILAŞTIRMASI (admin only)
  if (karsilastirma) {
    const { etiket, onceki, simdiki } = karsilastirma;
    const m2Degisim = onceki.toplamM2 > 0
      ? ((simdiki.toplamM2 - onceki.toplamM2) / onceki.toplamM2 * 100)
      : null;
    const m2Ek      = m2Degisim !== null
      ? ` (${m2Degisim >= 0 ? '+' : ''}${sayi(m2Degisim, 1)}%)`
      : '';
    const fireFark  = simdiki.fireOrani - onceki.fireOrani;
    const fireTrend = fireFark <= 0 ? '↓ İyi' : '↑ Dikkat';

    s.push('📈 *DÖNEM KARŞILAŞTIRMASI*');
    s.push(`   Önceki      : ${etiket}`);
    s.push(`   m²          : ${sayi(onceki.toplamM2, 0)} → ${sayi(simdiki.toplamM2, 0)}${m2Ek}`);
    s.push(`   Fire Oranı  : %${sayi(onceki.fireOrani, 2)} → %${sayi(simdiki.fireOrani, 2)}  (${fireTrend})`);
    s.push('─────────────────────────');
  }

  s.push('_Capssun Takip Sistemi_');

  return s.join('\n');
}

// ── HAFTALIK RAPOR MESAJI ─────────────────────────────────────
const GUNLER_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

function haftalikRaporuOlustur({ baslangicTarih, bitisTarih, uretimKayitlari, hurdaKayitlari, adminRaporu = false }) {
  const uretim = uretimOzetle(uretimKayitlari);
  const hurda  = hurdaOzetle(hurdaKayitlari);
  const simdi  = new Date();

  const tarihStr = d => `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()}`;

  // Günlük grupla
  const gunMap = {};
  for (const r of uretimKayitlari) {
    const d   = new Date(r.UretimTarihi);
    const key = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
    if (!gunMap[key]) gunMap[key] = { uretim: [], hurda: [] };
    gunMap[key].uretim.push(r);
  }
  for (const r of hurdaKayitlari) {
    const d   = new Date(r.KayitTarihi);
    const key = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
    if (!gunMap[key]) gunMap[key] = { uretim: [], hurda: [] };
    gunMap[key].hurda.push(r);
  }

  const s = [];

  // BAŞLIK
  s.push(`🏭 *HAFTALIK RAPOR*`);
  s.push(`📅 ${tarihStr(new Date(baslangicTarih))} – ${tarihStr(new Date(bitisTarih))}`);
  s.push(`📤 Gönderilme: ${saat(simdi)}`);
  s.push('─────────────────────────');

  // ÜRETİM
  s.push('📦 *ÜRETİM ÖZETİ*');
  const hatListesi = Object.keys(uretim).sort();
  const gunSayisi  = Math.max(Object.keys(gunMap).length, 1);

  if (hatListesi.length === 0) {
    s.push('   Kayıt bulunamadı.');
  } else {
    let genelUrun = 0, genelM2 = 0;
    for (const hat of hatListesi) {
      const u = uretim[hat];
      const toplam = u.tamUrun + u.ekliUrun + u.eksikUrun;
      genelUrun += toplam;
      genelM2   += u.toplamM2;
      s.push(`\n   🔹 *${hat}*`);
      s.push(`   Toplam Ürün     : ${sayi(toplam)} adet`);
      s.push(`   Toplam Üretim   : ${sayi(u.toplamM2, 1)} m²`);
      s.push(`   Günlük Ort.     : ${sayi(u.toplamM2 / gunSayisi, 1)} m²`);
    }
    s.push(`\n   📊 *Genel Toplam*`);
    s.push(`   Toplam Ürün     : ${sayi(genelUrun)} adet`);
    s.push(`   Toplam Üretim   : ${sayi(genelM2, 1)} m²`);
    s.push(`   Günlük Ort.     : ${sayi(genelM2 / gunSayisi, 1)} m²`);
  }

  s.push('─────────────────────────');

  // FİRE
  s.push('🔥 *FİRE BİLGİLERİ*');
  const hurdaHatlar = Object.keys(hurda).sort();
  const fireHatlar  = [...new Set([...hurdaHatlar, ...hatListesi])].sort();

  if (fireHatlar.length === 0) {
    s.push('   Kayıt bulunamadı.');
  } else {
    let gH = 0, gR = 0, gUretimKg = 0;
    for (const hat of fireHatlar) {
      const h        = hurda[hat] || { hurda: 0, recycle: 0, sarim: 0 };
      const labFire  = uretim[hat]?.labFire || 0;
      const uretimKg = uretim[hat]?.toplamUretimKg || 0;
      const recycleGosterim = h.recycle + h.sarim + labFire;
      const topFire  = h.hurda + recycleGosterim;
      const topGirdi = uretimKg + topFire;
      const fireOrani = topGirdi > 0 ? (topFire / topGirdi) * 100 : 0;
      s.push(`\n   🔸 *${hat}*`);
      s.push(`   Toplam Hurda    : ${sayi(h.hurda, 1)} kg`);
      s.push(`   Toplam Recycle  : ${sayi(recycleGosterim, 1)} kg`);
      s.push(`   Toplam Fire     : ${sayi(topFire, 1)} kg`);
      s.push(`   Fire Oranı      : %${sayi(fireOrani, 2)}`);
      gH += h.hurda; gR += recycleGosterim; gUretimKg += uretimKg;
    }
    const gTopFire  = gH + gR;
    const gTopGirdi = gUretimKg + gTopFire;
    const gFireOrani = gTopGirdi > 0 ? (gTopFire / gTopGirdi) * 100 : 0;
    s.push(`\n   📊 *Genel Toplam*`);
    s.push(`   Toplam Fire     : ${sayi(gTopFire, 1)} kg`);
    s.push(`   Fire Oranı      : %${sayi(gFireOrani, 2)}`);
  }

  s.push('─────────────────────────');

  // GÜNLÜK PERFORMANS
  s.push('📅 *GÜNLÜK PERFORMANS*');
  const gunKeys = Object.keys(gunMap).sort();
  const gunOzetler = [];

  for (const key of gunKeys) {
    const { uretim: gU, hurda: gH } = gunMap[key];
    const gunUretim = uretimOzetle(gU);
    const gunHurda  = hurdaOzetle(gH);

    let topM2 = 0, topUretimKg = 0, topHurda = 0, topRecycle = 0;
    for (const hat of Object.keys(gunUretim)) {
      topM2       += gunUretim[hat].toplamM2;
      topUretimKg += gunUretim[hat].toplamUretimKg;
      topRecycle  += gunUretim[hat].labFire || 0;
    }
    for (const hat of Object.keys(gunHurda)) {
      topHurda   += gunHurda[hat].hurda;
      topRecycle += gunHurda[hat].recycle + (gunHurda[hat].sarim || 0);
    }
    const topFire   = topHurda + topRecycle;
    const topGirdi  = topUretimKg + topFire;
    const fireOrani = topGirdi > 0 ? (topFire / topGirdi) * 100 : 0;

    const [yil, ay, gun] = key.split('-').map(Number);
    const d      = new Date(yil, ay - 1, gun);
    const gunAdi = GUNLER_TR[d.getDay()];

    gunOzetler.push({ gunAdi, gun, ay, topM2, fireOrani });
    s.push(`   ${gunAdi} ${pad2(gun)}.${pad2(ay)}: ${sayi(topM2, 0)} m²  |  Fire: %${sayi(fireOrani, 1)}`);
  }

  if (gunOzetler.length > 1) {
    const enIyi  = gunOzetler.reduce((a, b) => a.topM2 > b.topM2 ? a : b);
    const enKotu = gunOzetler.reduce((a, b) => a.topM2 < b.topM2 ? a : b);
    s.push(`\n   🥇 En İyi   : ${enIyi.gunAdi} ${pad2(enIyi.gun)}.${pad2(enIyi.ay)} – ${sayi(enIyi.topM2, 0)} m²`);
    s.push(`   📉 En Düşük : ${enKotu.gunAdi} ${pad2(enKotu.gun)}.${pad2(enKotu.ay)} – ${sayi(enKotu.topM2, 0)} m²`);
  }

  s.push('─────────────────────────');

  if (adminRaporu) {
    // VARDİYA AMİRİ PERFORMANSI
    const amirMap = {};
    for (const r of uretimKayitlari) {
      const v = r.Vardiya; if (!v) continue;
      if (!amirMap[v]) amirMap[v] = { m2: 0, uretimKg: 0, hurda: 0, recycle: 0, labFire: 0 };
      const metre = r.MetreKg || 0, gram = r.Gram || 0, gen = r.Genislik || 0;
      amirMap[v].m2       += metre * gen / 1000;
      amirMap[v].uretimKg += (gram / 1000) * (gen / 1000) * metre;
      amirMap[v].labFire  += (gram / 1000) * (gen / 1000);
    }
    for (const r of hurdaKayitlari) {
      const v = r.Vardiya; if (!v) continue;
      if (!amirMap[v]) amirMap[v] = { m2: 0, uretimKg: 0, hurda: 0, recycle: 0, labFire: 0 };
      amirMap[v].hurda   += (r.EriyikHurda || 0) + (r.HaliHurda || 0) + (r.RuloHurda || 0);
      amirMap[v].recycle += (r.HaliRecycle || 0) + (r.RuloRecycle || 0) + (r.Sarim || 0);
    }
    const amirHarfleri = Object.keys(amirMap).sort();
    if (amirHarfleri.length > 0) {
      s.push('👷 *VARDİYA AMİRİ PERFORMANSI*');
      for (const harf of amirHarfleri) {
        const a        = amirMap[harf];
        const topFire  = a.hurda + a.recycle + a.labFire;
        const topGirdi = a.uretimKg + topFire;
        const fireOrani = topGirdi > 0 ? (topFire / topGirdi) * 100 : 0;
        const amir     = config.vardiyaAmirleri[harf] || harf;
        s.push(`   ${amir} (${harf}): ${sayi(a.m2, 0)} m²  |  Fire: %${sayi(fireOrani, 1)}`);
      }
      s.push('─────────────────────────');
    }

    // FİRE ORANI TRENDİ (ilk yarı / ikinci yarı)
    const gunKeysAll = Object.keys(gunMap).sort();
    if (gunKeysAll.length >= 2) {
      const yari       = Math.ceil(gunKeysAll.length / 2);
      const ilkGunler  = gunKeysAll.slice(0, yari);
      const ikinciGunler = gunKeysAll.slice(yari);

      function yariFireOrani(gunKeys) {
        let uretimKg = 0, topHurda = 0, topRecycle = 0;
        for (const key of gunKeys) {
          const gu = uretimOzetle(gunMap[key].uretim);
          const gh = hurdaOzetle(gunMap[key].hurda);
          for (const hat of Object.keys(gu)) {
            uretimKg   += gu[hat].toplamUretimKg;
            topRecycle += gu[hat].labFire || 0;
          }
          for (const hat of Object.keys(gh)) {
            topHurda   += gh[hat].hurda;
            topRecycle += gh[hat].recycle + (gh[hat].sarim || 0);
          }
        }
        const topFire  = topHurda + topRecycle;
        const topGirdi = uretimKg + topFire;
        return topGirdi > 0 ? (topFire / topGirdi) * 100 : 0;
      }

      const ilkFire    = yariFireOrani(ilkGunler);
      const ikinciFire = yariFireOrani(ikinciGunler);
      const trend = ikinciFire > ilkFire + 0.5 ? '⬆️ Artış'
                  : ikinciFire < ilkFire - 0.5 ? '⬇️ Azalış'
                  : '➡️ Stabil';

      s.push('📉 *FİRE ORANI TRENDİ*');
      s.push(`   İlk yarı     : %${sayi(ilkFire, 2)}`);
      s.push(`   İkinci yarı  : %${sayi(ikinciFire, 2)}`);
      s.push(`   Trend        : ${trend}`);
      s.push('─────────────────────────');
    }
  }

  s.push('_Capssun Takip Sistemi_');

  return s.join('\n');
}

// ── AYLIK RAPOR MESAJI ────────────────────────────────────────
const AYLAR_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function aylikRaporuOlustur({ yil, ay, uretimKayitlari, hurdaKayitlari, adminRaporu = false }) {
  const uretim = uretimOzetle(uretimKayitlari);
  const hurda  = hurdaOzetle(hurdaKayitlari);
  const simdi  = new Date();

  // Haftanın Pazartesi'sini bul
  function pazartesiBul(d) {
    const r = new Date(d); r.setHours(0, 0, 0, 0);
    const g = r.getDay();
    r.setDate(r.getDate() - (g === 0 ? 6 : g - 1));
    return r;
  }

  // Hafta bazında grupla
  const haftaMap = {};
  for (const r of uretimKayitlari) {
    const pzt = pazartesiBul(new Date(r.UretimTarihi));
    const key = `${pzt.getFullYear()}-${pad2(pzt.getMonth()+1)}-${pad2(pzt.getDate())}`;
    if (!haftaMap[key]) haftaMap[key] = { uretim: [], hurda: [], pzt };
    haftaMap[key].uretim.push(r);
  }
  for (const r of hurdaKayitlari) {
    const pzt = pazartesiBul(new Date(r.KayitTarihi));
    const key = `${pzt.getFullYear()}-${pad2(pzt.getMonth()+1)}-${pad2(pzt.getDate())}`;
    if (!haftaMap[key]) haftaMap[key] = { uretim: [], hurda: [], pzt };
    haftaMap[key].hurda.push(r);
  }

  const s = [];
  const haftaSayisi = Math.max(Object.keys(haftaMap).length, 1);

  // BAŞLIK
  s.push(`🏭 *AYLIK RAPOR*`);
  s.push(`📅 ${AYLAR_TR[ay - 1]} ${yil}`);
  s.push(`📤 Gönderilme: ${saat(simdi)}`);
  s.push('─────────────────────────');

  // ÜRETİM
  s.push('📦 *ÜRETİM ÖZETİ*');
  const hatListesi = Object.keys(uretim).sort();

  if (hatListesi.length === 0) {
    s.push('   Kayıt bulunamadı.');
  } else {
    let genelUrun = 0, genelM2 = 0;
    for (const hat of hatListesi) {
      const u = uretim[hat];
      const toplam = u.tamUrun + u.ekliUrun + u.eksikUrun;
      genelUrun += toplam;
      genelM2   += u.toplamM2;
      s.push(`\n   🔹 *${hat}*`);
      s.push(`   Toplam Ürün     : ${sayi(toplam)} adet`);
      s.push(`   Toplam Üretim   : ${sayi(u.toplamM2, 1)} m²`);
      s.push(`   Haftalık Ort.   : ${sayi(u.toplamM2 / haftaSayisi, 1)} m²`);
    }
    s.push(`\n   📊 *Genel Toplam*`);
    s.push(`   Toplam Ürün     : ${sayi(genelUrun)} adet`);
    s.push(`   Toplam Üretim   : ${sayi(genelM2, 1)} m²`);
    s.push(`   Haftalık Ort.   : ${sayi(genelM2 / haftaSayisi, 1)} m²`);
  }

  s.push('─────────────────────────');

  // FİRE
  s.push('🔥 *FİRE BİLGİLERİ*');
  const hurdaHatlar = Object.keys(hurda).sort();
  const fireHatlar  = [...new Set([...hurdaHatlar, ...hatListesi])].sort();

  if (fireHatlar.length === 0) {
    s.push('   Kayıt bulunamadı.');
  } else {
    let gH = 0, gR = 0, gUretimKg = 0;
    for (const hat of fireHatlar) {
      const h        = hurda[hat] || { hurda: 0, recycle: 0, sarim: 0 };
      const labFire  = uretim[hat]?.labFire || 0;
      const uretimKg = uretim[hat]?.toplamUretimKg || 0;
      const recycleGosterim = h.recycle + h.sarim + labFire;
      const topFire  = h.hurda + recycleGosterim;
      const topGirdi = uretimKg + topFire;
      const fireOrani = topGirdi > 0 ? (topFire / topGirdi) * 100 : 0;
      s.push(`\n   🔸 *${hat}*`);
      s.push(`   Toplam Hurda    : ${sayi(h.hurda, 1)} kg`);
      s.push(`   Toplam Recycle  : ${sayi(recycleGosterim, 1)} kg`);
      s.push(`   Toplam Fire     : ${sayi(topFire, 1)} kg`);
      s.push(`   Fire Oranı      : %${sayi(fireOrani, 2)}`);
      gH += h.hurda; gR += recycleGosterim; gUretimKg += uretimKg;
    }
    const gTopFire  = gH + gR;
    const gTopGirdi = gUretimKg + gTopFire;
    const gFireOrani = gTopGirdi > 0 ? (gTopFire / gTopGirdi) * 100 : 0;
    s.push(`\n   📊 *Genel Toplam*`);
    s.push(`   Toplam Fire     : ${sayi(gTopFire, 1)} kg`);
    s.push(`   Fire Oranı      : %${sayi(gFireOrani, 2)}`);
  }

  s.push('─────────────────────────');

  // HAFTALIK PERFORMANS
  s.push('📅 *HAFTALIK PERFORMANS*');
  const haftaKeys   = Object.keys(haftaMap).sort();
  const haftaOzetler = [];

  for (let i = 0; i < haftaKeys.length; i++) {
    const { uretim: hU, hurda: hH, pzt } = haftaMap[haftaKeys[i]];
    const paz = new Date(pzt); paz.setDate(pzt.getDate() + 6);

    const hafUretim = uretimOzetle(hU);
    const hafHurda  = hurdaOzetle(hH);

    let topM2 = 0, topUretimKg = 0, topHurda = 0, topRecycle = 0;
    for (const hat of Object.keys(hafUretim)) {
      topM2       += hafUretim[hat].toplamM2;
      topUretimKg += hafUretim[hat].toplamUretimKg;
      topRecycle  += hafUretim[hat].labFire || 0;
    }
    for (const hat of Object.keys(hafHurda)) {
      topHurda   += hafHurda[hat].hurda;
      topRecycle += hafHurda[hat].recycle + (hafHurda[hat].sarim || 0);
    }
    const topFire   = topHurda + topRecycle;
    const topGirdi  = topUretimKg + topFire;
    const fireOrani = topGirdi > 0 ? (topFire / topGirdi) * 100 : 0;
    const no        = i + 1;

    haftaOzetler.push({ no, topM2, fireOrani });
    s.push(`   H${no} ${pad2(pzt.getDate())}.${pad2(pzt.getMonth()+1)}–${pad2(paz.getDate())}.${pad2(paz.getMonth()+1)}: ${sayi(topM2, 0)} m²  |  Fire: %${sayi(fireOrani, 1)}`);
  }

  if (haftaOzetler.length > 1) {
    const enIyi  = haftaOzetler.reduce((a, b) => a.topM2 > b.topM2 ? a : b);
    const enKotu = haftaOzetler.reduce((a, b) => a.topM2 < b.topM2 ? a : b);
    s.push(`\n   🥇 En İyi   : H${enIyi.no} – ${sayi(enIyi.topM2, 0)} m²`);
    s.push(`   📉 En Düşük : H${enKotu.no} – ${sayi(enKotu.topM2, 0)} m²`);
  }

  s.push('─────────────────────────');

  if (adminRaporu) {
    // VARDİYA AMİRİ PERFORMANSI
    const amirMap = {};
    for (const r of uretimKayitlari) {
      const v = r.Vardiya; if (!v) continue;
      if (!amirMap[v]) amirMap[v] = { m2: 0, uretimKg: 0, hurda: 0, recycle: 0, labFire: 0 };
      const metre = r.MetreKg || 0, gram = r.Gram || 0, gen = r.Genislik || 0;
      amirMap[v].m2       += metre * gen / 1000;
      amirMap[v].uretimKg += (gram / 1000) * (gen / 1000) * metre;
      amirMap[v].labFire  += (gram / 1000) * (gen / 1000);
    }
    for (const r of hurdaKayitlari) {
      const v = r.Vardiya; if (!v) continue;
      if (!amirMap[v]) amirMap[v] = { m2: 0, uretimKg: 0, hurda: 0, recycle: 0, labFire: 0 };
      amirMap[v].hurda   += (r.EriyikHurda || 0) + (r.HaliHurda || 0) + (r.RuloHurda || 0);
      amirMap[v].recycle += (r.HaliRecycle || 0) + (r.RuloRecycle || 0) + (r.Sarim || 0);
    }
    const amirHarfleri = Object.keys(amirMap).sort();
    if (amirHarfleri.length > 0) {
      s.push('👷 *VARDİYA AMİRİ PERFORMANSI*');
      for (const harf of amirHarfleri) {
        const a        = amirMap[harf];
        const topFire  = a.hurda + a.recycle + a.labFire;
        const topGirdi = a.uretimKg + topFire;
        const fireOrani = topGirdi > 0 ? (topFire / topGirdi) * 100 : 0;
        const amir     = config.vardiyaAmirleri[harf] || harf;
        s.push(`   ${amir} (${harf}): ${sayi(a.m2, 0)} m²  |  Fire: %${sayi(fireOrani, 1)}`);
      }
      s.push('─────────────────────────');
    }
  }

  s.push('_Capssun Takip Sistemi_');

  return s.join('\n');
}

module.exports = { vardiyaRaporuOlustur, gunlukRaporuOlustur, haftalikRaporuOlustur, aylikRaporuOlustur, anlikUretimOzetle, uretimOzetle, hurdaOzetle, vardiyaAmiriBul };

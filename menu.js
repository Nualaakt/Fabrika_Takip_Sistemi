// ══════════════════════════════════════════════════════════════
//  menu.js  –  WhatsApp mesaj dinleme ve menü sistemi
// ══════════════════════════════════════════════════════════════

const db     = require('./db');
const config = require('./config');
const { vardiyaRaporuOlustur, gunlukRaporuOlustur, haftalikRaporuOlustur, aylikRaporuOlustur, anlikUretimOzetle, uretimOzetle, hurdaOzetle, vardiyaAmiriBul } = require('./rapor');
const { llmSor, gecmisSifirla } = require('./llm/ollama');
const { ilgiliBelgeleriGetir, ilgiliQAlariGetir } = require('./llm/bilgi');
const fs   = require('fs');
const path = require('path');

// ── Kalıcı hafıza ─────────────────────────────────────────────
const HAFIZA_DOSYA = path.join(__dirname, 'llm', 'prosedurler', 'hafiza.txt');

function hafizayaKaydet(bilgi) {
  const satir = `[${new Date().toLocaleDateString('tr-TR')}] ${bilgi}\n`;
  fs.appendFileSync(HAFIZA_DOSYA, satir, 'utf8');
}

function hafizaOku() {
  try {
    return fs.existsSync(HAFIZA_DOSYA)
      ? fs.readFileSync(HAFIZA_DOSYA, 'utf8').trim()
      : '';
  } catch { return ''; }
}

// ── Kullanıcı oturum durumları ────────────────────────────────
// adim:  'ana' | 'vardiya' | 'gunluk' | 'haftalik' | 'aylik'
// bolum: null | 'uretim' | 'mikser' | 'bakim'  (yalnızca admin)
const oturumlar = {};

function oturumAl(tel) {
  if (!oturumlar[tel]) oturumlar[tel] = { adim: 'ana', bolum: null };
  return oturumlar[tel];
}

function oturumSifirla(tel) {
  oturumlar[tel] = { adim: 'ana', bolum: null };
}

// ── Kullanıcı birimi / rolü ───────────────────────────────────
//  Dönüş: 'admin' | 'uretim' | 'kalite' | 'bakim' | 'depo'
function kullaniciBirimiBul(tel) {
  const alici = config.alicilar.find(a => {
    if (a.gid) return tel === a.gid;
    const temiz = (a.tel || '').replace(/[^0-9]/g, '');
    return tel === temiz + '@c.us' || tel === a.lid;
  });
  return alici?.rol || 'uretim';
}

// Geriye dönük uyumluluk için alias
const kullaniciRoluBul = kullaniciBirimiBul;

// ── Tarih yardımcıları ────────────────────────────────────────
const pad2     = n => String(n).padStart(2, '0');
const tarihStr = d => `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()}`;
const AYLAR_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

// Son 2 günün vardiyaları (6 seçenek)
function sonVardiyalariListele() {
  const simdi   = new Date();
  const saatTR  = simdi.getHours();
  const liste   = [];

  const bugun = new Date(simdi); bugun.setHours(0, 0, 0, 0);
  const dun   = new Date(bugun); dun.setDate(dun.getDate() - 1);
  const onceki = new Date(dun);  onceki.setDate(onceki.getDate() - 1);

  if (saatTR >= 8)  liste.push({ tarih: bugun,  vardiyaNo: 1, etiket: `Bugün V1 (00:00-08:00)` });
  if (saatTR >= 16) liste.push({ tarih: bugun,  vardiyaNo: 2, etiket: `Bugün V2 (08:00-16:00)` });

  liste.push({ tarih: dun, vardiyaNo: 3, etiket: `Dün V3 (16:00-24:00)` });
  liste.push({ tarih: dun, vardiyaNo: 2, etiket: `Dün V2 (08:00-16:00)` });
  liste.push({ tarih: dun, vardiyaNo: 1, etiket: `Dün V1 (00:00-08:00)` });
  liste.push({ tarih: onceki, vardiyaNo: 3, etiket: `${tarihStr(onceki)} V3 (16:00-24:00)` });

  return liste;
}

// Son 7 günün listesi
function sonYediGunListele() {
  const liste = [];
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const gun = new Date(bugun); gun.setDate(gun.getDate() - i);
    const etiket = i === 0 ? `Bugün (${tarihStr(gun)})` :
                   i === 1 ? `Dün (${tarihStr(gun)})` :
                   tarihStr(gun);
    liste.push({ tarih: gun, etiket });
  }
  return liste;
}

// Son 4 tamamlanmış hafta (Pzt–Paz)
function sonDortHaftaListele() {
  const simdi  = new Date();
  const gunNo  = simdi.getDay(); // 0=Paz, 1=Pzt, ...

  // En son tamamlanan Pazar
  const sonPazar = new Date(simdi);
  if (gunNo !== 0) sonPazar.setDate(simdi.getDate() - gunNo);
  sonPazar.setHours(23, 59, 59, 999);

  const liste = [];
  for (let i = 0; i < 4; i++) {
    const paz = new Date(sonPazar); paz.setDate(sonPazar.getDate() - i * 7);
    const pzt = new Date(paz);      pzt.setDate(paz.getDate() - 6); pzt.setHours(0, 0, 0, 0);
    liste.push({ baslangic: pzt, bitis: paz, etiket: `${tarihStr(pzt)} – ${tarihStr(paz)}` });
  }
  return liste;
}

// Son 3 tamamlanmış ay
function sonUcAyListele() {
  const simdi = new Date();
  const liste = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(simdi.getFullYear(), simdi.getMonth() - i, 1);
    liste.push({ yil: d.getFullYear(), ay: d.getMonth() + 1, etiket: `${AYLAR_TR[d.getMonth()]} ${d.getFullYear()}` });
  }
  return liste;
}

// ── Sabit mesajlar ────────────────────────────────────────────
function botMesaji() {
  return [
    '🤖 Ben yalnızca bir *üretim raporlama* botuyum.',
    'Bu numara üzerinden iletişim kurulmamaktadır.',
    '',
    'Rapor almak için *rapor* yazabilirsiniz.',
    '',
    'İletişim için: *Kaan Talu*',
  ].join('\n');
}

// ── Menü mesajları ────────────────────────────────────────────
//
//  Her birimin gördüğü menü seçenekleri:
//
//  uretim / admin : Üretim raporları + anlık durum
//  kalite         : Kalite raporları — yakında eklenecek
//  bakim          : Arıza bildirimleri — yakında eklenecek
//  depo           : Sevkiyat & stok raporları — yakında eklenecek
//
function adminUstMenuMesaji() {
  return [
    '🏭 *CAPSSUN TAKİP SİSTEMİ*',
    '─────────────────────────',
    '1️⃣  Üretim',
    '2️⃣  Mikser',
    '3️⃣  Bakım',
    '─────────────────────────',
    '_Seçmek için numara yaz._',
  ].join('\n');
}

function bakimMenuMesaji() {
  return [
    '🔧 *BAKIM RAPOR SİSTEMİ*',
    '─────────────────────────',
    '_(Yakında eklenecek)_',
    '─────────────────────────',
    '_Ana menü için: rapor_',
  ].join('\n');
}

function anaMenuMesaji(birim = 'uretim') {
  // ── Üretim birimi (ve admin) ─────────────────────────────────
  if (birim === 'admin' || birim === 'uretim') {
    return [
      '📋 *ÜRETİM RAPOR SİSTEMİ*',
      '─────────────────────────',
      '1️⃣  Son vardiya raporu',
      '2️⃣  Vardiya raporu seç (son 48 saat)',
      '3️⃣  Günlük rapor (son 7 gün)',
      '4️⃣  Haftalık rapor (son 4 hafta)',
      '5️⃣  Aylık rapor (son 3 ay)',
      '6️⃣  Anlık üretim durumu',
      '─────────────────────────',
      '_Seçmek için numara yaz._',
    ].join('\n');
  }

  // ── Kalite birimi ─────────────────────────────────────────────
  if (birim === 'kalite') {
    return [
      '🧪 *KALİTE RAPOR SİSTEMİ*',
      '─────────────────────────',
      '_(Yakında: Günlük kalite özeti)_',
      '_(Yakında: Reometre sonuçları)_',
      '─────────────────────────',
      '_Soru sormak için yazın._',
    ].join('\n');
  }

  // ── Bakım birimi ──────────────────────────────────────────────
  if (birim === 'bakim') {
    return [
      '🔧 *BAKIM RAPOR SİSTEMİ*',
      '─────────────────────────',
      '_(Yakında: Açık arıza listesi)_',
      '_(Yakında: Arıza geçmişi)_',
      '─────────────────────────',
      '_Soru sormak için yazın._',
    ].join('\n');
  }

  // ── Depo birimi ───────────────────────────────────────────────
  if (birim === 'depo') {
    return [
      '🚚 *DEPO RAPOR SİSTEMİ*',
      '─────────────────────────',
      '_(Yakında: Günlük sevkiyat raporu)_',
      '_(Yakında: Stok durumu)_',
      '─────────────────────────',
      '_Soru sormak için yazın._',
    ].join('\n');
  }

  // ── Mikser birimi ─────────────────────────────────────────────
  if (birim === 'mikser') {
    return [
      '🔧 *MİKSER RAPOR SİSTEMİ*',
      '─────────────────────────',
      '1️⃣  Mikser durumu',
      '─────────────────────────',
      '_Seçmek için numara yaz._',
    ].join('\n');
  }

  // Bilinmeyen birim — genel menü göster
  return [
    '📋 *RAPOR SİSTEMİ*',
    '─────────────────────────',
    '1️⃣  Son vardiya raporu',
    '2️⃣  Vardiya raporu seç',
    '3️⃣  Günlük rapor',
    '4️⃣  Haftalık rapor',
    '5️⃣  Aylık rapor',
    '6️⃣  Anlık durum',
    '─────────────────────────',
    '_Seçmek için numara yaz._',
  ].join('\n');
}

function altMenuMesaji(baslik, liste) {
  const satirlar = [baslik, '─────────────────────────'];
  liste.forEach((v, i) => satirlar.push(`${i + 1}️⃣  ${v.etiket}`));
  satirlar.push('─────────────────────────');
  satirlar.push('0️⃣  Ana menü');
  satirlar.push('_Seçmek için numara yaz._');
  return satirlar.join('\n');
}

// ── Ana mesaj işleyici ────────────────────────────────────────
async function mesajiIsle(tel, metin) {
  const giris  = metin.trim().toLowerCase();
  const oturum = oturumAl(tel);
  const birim  = kullaniciBirimiBul(tel);   // 'admin' | 'uretim' | 'kalite' | 'bakim' | 'depo'
  const admin  = birim === 'admin';

  // Üretim raporlarına erişim: admin + uretim birimi
  const uretimErisimi = admin || birim === 'uretim';

  // Özel komutlar
  if (giris === 'rapor' || giris === 'menu' || giris === 'menü') {
    oturumSifirla(tel);
    gecmisSifirla(tel);
    if (admin) return adminUstMenuMesaji();
    return anaMenuMesaji(birim);
  }

  if (giris === 'sıfırla' || giris === 'sifirla' || giris === 'temizle') {
    oturumSifirla(tel);
    gecmisSifirla(tel);
    return '🔄 Sohbet geçmişi temizlendi.';
  }

  // Hafıza komutu: "öğren: ..." veya "unutma: ..."
  if (metin.trim().toLowerCase().startsWith('öğren:') || metin.trim().toLowerCase().startsWith('ogren:')) {
    const bilgi = metin.trim().replace(/^(öğren|ogren)\s*:\s*/i, '').trim();
    if (!bilgi) return '❓ Ne öğreneyim? Örnek: _öğren: EXT-1 ideal sıcaklığı 185°C_';
    hafizayaKaydet(bilgi);
    return `✅ Kaydettim:\n_"${bilgi}"_`;
  }

  if (metin.trim().toLowerCase().startsWith('hafıza') || metin.trim().toLowerCase().startsWith('hafiza')) {
    const icerik = hafizaOku();
    return icerik
      ? `🧠 *Kayıtlı bilgiler:*\n\n${icerik}`
      : '🧠 Henüz kaydedilmiş bilgi yok.';
  }

  // ── MİKSER MENÜSÜ (birim bazlı) ──────────────────────────
  if (birim === 'mikser') {
    return await mikserRaporuGetir();
  }

  // ── ALT MENÜ SEÇİMLERİ — adim bazlı, admin bloğundan ÖNCE ──
  // adim='gunluk'/'vardiya'/... iken gelen numara her zaman
  // o alt menüye ait seçimdir; admin bolum durumundan bağımsız.

  // ── VARDİYA MENÜSÜ ────────────────────────────────────────
  if (oturum.adim === 'vardiya') {
    if (giris === '0') { oturumSifirla(tel); return anaMenuMesaji(birim); }
    const secim = parseInt(giris);
    if (secim >= 1 && secim <= (oturum.liste || []).length) {
      const v = oturum.liste[secim - 1];
      oturumSifirla(tel);
      return await vardiyaRaporuGetir(v.vardiyaNo, v.tarih, admin);
    }
    return `❓ Geçersiz seçim. Listeden bir numara yaz veya *rapor* yaz.`;
  }

  // ── GÜNLÜK MENÜSÜ ─────────────────────────────────────────
  if (oturum.adim === 'gunluk') {
    if (giris === '0') { oturumSifirla(tel); return anaMenuMesaji(birim); }
    const secim = parseInt(giris);
    if (secim >= 1 && secim <= (oturum.liste || []).length) {
      const g = oturum.liste[secim - 1];
      oturumSifirla(tel);
      return await gunlukRaporuGetir(g.tarih, admin);
    }
    return `❓ Geçersiz seçim. Listeden bir numara yaz veya *rapor* yaz.`;
  }

  // ── HAFTALIK MENÜSÜ ───────────────────────────────────────
  if (oturum.adim === 'haftalik') {
    if (giris === '0') { oturumSifirla(tel); return anaMenuMesaji(birim); }
    const secim = parseInt(giris);
    if (secim >= 1 && secim <= (oturum.liste || []).length) {
      const h = oturum.liste[secim - 1];
      oturumSifirla(tel);
      return await haftalikRaporuGetir(h.baslangic, h.bitis, admin);
    }
    return `❓ Geçersiz seçim. Listeden bir numara yaz veya *rapor* yaz.`;
  }

  // ── AYLIK MENÜSÜ ──────────────────────────────────────────
  if (oturum.adim === 'aylik') {
    if (giris === '0') { oturumSifirla(tel); return anaMenuMesaji(birim); }
    const secim = parseInt(giris);
    if (secim >= 1 && secim <= (oturum.liste || []).length) {
      const a = oturum.liste[secim - 1];
      oturumSifirla(tel);
      return await aylikRaporuGetir(a.yil, a.ay, admin);
    }
    return `❓ Geçersiz seçim. Listeden bir numara yaz veya *rapor* yaz.`;
  }

  // ── ADMİN ÜST MENÜ ────────────────────────────────────────
  // Yalnızca adim='ana' durumunda ulaşılır
  if (admin && !oturum.bolum) {
    if (giris === '1') { oturum.bolum = 'uretim'; return anaMenuMesaji('uretim'); }
    if (giris === '2') { oturum.bolum = 'mikser'; return await mikserRaporuGetir(); }
    if (giris === '3') { oturum.bolum = 'bakim';  return await bakimRaporuGetir(); }
    return await llmYanit(tel, metin);
  }

  if (admin && oturum.bolum === 'mikser') {
    return await mikserRaporuGetir();
  }
  if (admin && oturum.bolum === 'bakim') {
    return await bakimRaporuGetir();
  }

  // ── ANA MENÜ (adim='ana', bolum='uretim' veya non-admin) ──
  if (oturum.adim === 'ana') {
    if (!uretimErisimi && ['1','2','3','4','5','6'].includes(giris)) {
      return `⛔ Bu rapor *${birim}* birimi için mevcut değil.\n_Rapor sistemine erişmek için ilgili birimi yöneticiyle görüşün._`;
    }
    if (giris === '1') {
      const { vardiyaNo, referansTarih } = sonVardiyayiBul();
      return await vardiyaRaporuGetir(vardiyaNo, referansTarih, admin);
    }
    if (giris === '2') {
      const liste = sonVardiyalariListele();
      oturum.adim = 'vardiya'; oturum.liste = liste;
      return altMenuMesaji('⏱️ *VARDİYA SEÇ*', liste);
    }
    if (giris === '3') {
      const liste = sonYediGunListele();
      oturum.adim = 'gunluk'; oturum.liste = liste;
      return altMenuMesaji('📅 *TARİH SEÇ*', liste);
    }
    if (giris === '4') {
      const liste = sonDortHaftaListele();
      oturum.adim = 'haftalik'; oturum.liste = liste;
      return altMenuMesaji('📊 *HAFTA SEÇ*', liste);
    }
    if (giris === '5') {
      const liste = sonUcAyListele();
      oturum.adim = 'aylik'; oturum.liste = liste;
      return altMenuMesaji('📆 *AY SEÇ*', liste);
    }
    if (giris === '6') {
      return await anlikDurumGetir();
    }
    return await llmYanit(tel, metin);
  }

  return botMesaji();
}

// ── Son vardiyayı bul ─────────────────────────────────────────
function sonVardiyayiBul() {
  const simdi  = new Date();
  const saatTR = simdi.getHours();
  let vardiyaNo;
  if      (saatTR >= 8 && saatTR < 16) vardiyaNo = 1;
  else if (saatTR >= 16)               vardiyaNo = 2;
  else                                  vardiyaNo = 3;
  return { vardiyaNo, referansTarih: new Date(simdi) };
}

// ── Bakım raporu ──────────────────────────────────────────────
async function bakimRaporuGetir() {
  try {
    const [acikArizalar, yaklaşanBakimlar] = await Promise.all([
      db.acikArizalariGetir(),
      db.yaklaşanBakimlariGetir(7),
    ]);

    const simdi = new Date();
    const saatStr = `${pad2(simdi.getHours())}:${pad2(simdi.getMinutes())}`;
    const s = [];

    s.push('🔧 *BAKIM DURUMU*');
    s.push(`🕐 ${saatStr} itibarıyla`);
    s.push('─────────────────────────');

    s.push(`*Açık Arızalar (${acikArizalar.length}):*`);
    if (acikArizalar.length > 0) {
      for (const a of acikArizalar) {
        const oncelikEmoji = a.Oncelik === 'Kritik' ? '🔴' : a.Oncelik === 'Yüksek' ? '🟠' : '🟡';
        const bildirimTarihi = a.BaslangicTarihi
          ? new Date(a.BaslangicTarihi).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
          : '?';
        s.push(`${oncelikEmoji} *${a.ArizaId}*`);
        s.push(`   📍 Arıza Yeri     : ${a.ArizaYeri || '?'}`);
        s.push(`   🔧 Arıza Türü     : ${a.ArizaTuru || '?'}`);
        s.push(`   ⚡ Öncelik        : ${a.Oncelik || '?'}`);
        s.push(`   📋 İşlem Durumu   : ${a.IslemDurumu || '?'}`);
        s.push(`   📅 Bildirim Tarihi: ${bildirimTarihi}`);
        if (a.Aciklamalar) s.push(`   💬 Açıklama      : ${a.Aciklamalar}`);
        s.push('');
      }
    } else {
      s.push('   ✅ Açık arıza yok');
    }

    s.push('─────────────────────────');
    s.push(`*Yaklaşan Bakımlar — 7 Gün (${yaklaşanBakimlar.length}):*`);
    if (yaklaşanBakimlar.length > 0) {
      for (const b of yaklaşanBakimlar) {
        const sonrakiTarih = b.SonrakiBakimTarihi
          ? new Date(b.SonrakiBakimTarihi).toLocaleDateString('tr-TR')
          : '?';
        s.push(`🟡 *${b.Ekipman}*`);
        s.push(`   🔧 Bakım Türü     : ${b.BakimTuru || '?'}`);
        s.push(`   📅 Planlanan Tarih: ${sonrakiTarih}`);
        s.push(`   📋 Durum          : ${b.Durum || '?'}`);
        if (b.SorumluKisiler) s.push(`   👤 Sorumlu        : ${b.SorumluKisiler}`);
        if (b.Aciklama) s.push(`   💬 Açıklama       : ${b.Aciklama}`);
        s.push('');
      }
    } else {
      s.push('   ✅ Yaklaşan bakım yok');
    }

    s.push('─────────────────────────');
    s.push('_Capssun Takip Sistemi_');
    return s.join('\n');
  } catch (err) {
    return `❌ Bakım durumu alınamadı: ${err.message}`;
  }
}

// ── Mikser raporu ─────────────────────────────────────────────
async function mikserRaporuGetir() {
  try {
    const [aktifMikserler, bekleyenMikserler] = await Promise.all([
      db.aktifMikserlerGetir(),
      db.bekleyenMikserlerGetir(),
    ]);

    const simdi = new Date();
    const saatStr = `${pad2(simdi.getHours())}:${pad2(simdi.getMinutes())}`;
    const s = [];

    s.push(`🔧 *MİKSER DURUMU*`);
    s.push(`🕐 ${saatStr} itibarıyla`);
    s.push('─────────────────────────');

    s.push('*Yüklü Mikserler:*');
    if (aktifMikserler.length > 0) {
      for (const m of aktifMikserler) {
        s.push(`   🔵 Mikser ${m.MixerLine} | ${m.SemiProductType} | ${Number(m.TotalKg).toLocaleString('tr-TR')} kg`);
        s.push(`   🔢 Lot: \`${m.LotNo}\``);
      }
    } else {
      s.push('   Yüklü mikser yok');
    }

    s.push('─────────────────────────');
    s.push('*Yerdeki Mikserler (Hazır Stok):*');
    if (bekleyenMikserler.length > 0) {
      for (const m of bekleyenMikserler) {
        s.push(`   ⏳ ${m.SemiProductType}: ${Number(m.ToplamKg).toLocaleString('tr-TR')} kg  (${m.MikserSayisi} mikser)`);
      }
    } else {
      s.push('   Yerde bekleyen mikser yok');
    }

    s.push('─────────────────────────');
    s.push('_Capssun Takip Sistemi_');
    return s.join('\n');
  } catch (err) {
    return `❌ Mikser durumu alınamadı: ${err.message}`;
  }
}

// ── Anlık üretim durumu (menü seçeneği 6) ────────────────────
async function anlikDurumGetir() {
  try {
    const [anlikHam, aktifMikserler, bekleyenMikserler] = await Promise.all([
      db.anlikUretimDurumuGetir(),
      db.aktifMikserlerGetir(),
      db.bekleyenMikserlerGetir(),
    ]);

    const anlik = anlikUretimOzetle(anlikHam);
    const simdi = new Date();
    const pad2l = n => String(n).padStart(2, '0');
    const saatStr = `${pad2l(simdi.getHours())}:${pad2l(simdi.getMinutes())}`;

    const s = [];
    s.push('🔴 *ANLIK ÜRETİM DURUMU*');
    s.push(`🕐 ${saatStr} itibarıyla`);
    s.push('─────────────────────────');

    if (Object.keys(anlik).length === 0) {
      s.push('   Kayıt bulunamadı.');
    } else {
      for (const hat of Object.keys(anlik).sort()) {
        const a = anlik[hat];
        const gramajStr   = a.gramaj   !== null ? `${a.gramaj}g`    : '?g';
        const genislikStr = a.genislik !== null ? `${a.genislik}mm` : '?mm';
        s.push(`   🔹 *${hat}* : ${gramajStr}  ·  ${genislikStr}`);
      }
    }

    s.push('─────────────────────────');
    s.push('🔧 *MİKSER*');
    if (aktifMikserler.length > 0) {
      for (const m of aktifMikserler) {
        s.push(`   ✅ M${m.MixerLine} | ${m.SemiProductType} | ${Number(m.TotalKg).toLocaleString('tr-TR')} kg`);
      }
    } else {
      s.push('   ✅ Yüklü mikser yok');
    }
    if (bekleyenMikserler.length > 0) {
      s.push('   ⏳ Hazır stok:');
      for (const m of bekleyenMikserler) {
        s.push(`   • ${m.SemiProductType}: ${Number(m.ToplamKg).toLocaleString('tr-TR')} kg`);
      }
    }

    return s.join('\n');
  } catch (err) {
    return `❌ Anlık durum alınamadı: ${err.message}`;
  }
}

// ── Rapor getirici fonksiyonlar ───────────────────────────────
async function vardiyaRaporuGetir(vardiyaNo, referansTarih, includeMikser = true) {
  const vConf = config.vardiyalar.find(v => v.no === vardiyaNo);
  const displayTarih = new Date(referansTarih);
  const baslangic = new Date(displayTarih);
  baslangic.setHours(vConf.baslangicSaat, 0, 0, 0);
  const bitis = new Date(displayTarih);
  bitis.setHours(vConf.bitisSaat === 24 ? 23 : vConf.bitisSaat,
                 vConf.bitisSaat === 24 ? 59 : 0, 0, 0);

  try {
    const uretimKayitlari = await db.uretimVerileriniGetir(referansTarih, vConf.baslangicSaat, vConf.bitisSaat);
    const vardiyaHarfi = uretimKayitlari.length > 0
      ? uretimKayitlari[Math.floor(uretimKayitlari.length / 2)].Vardiya
      : null;

    const [hurdaKayitlari, beslemeKayitlari, aktifMikserler, bekleyenMikserler, anlikHam] =
      await Promise.all([
        vardiyaHarfi ? db.hurdaVerileriniGetir(referansTarih, vardiyaHarfi) : Promise.resolve([]),
        db.beslemeTuketimGetir(referansTarih, vConf.baslangicSaat, vConf.bitisSaat),
        db.aktifMikserlerGetir(),
        db.bekleyenMikserlerGetir(),
        db.anlikUretimDurumuGetir(),
      ]);

    const anlikUretim = anlikUretimOzetle(anlikHam);

    // Stok tükenme tahmini — yalnızca admin için (includeMikser=true)
    let stokTahmini = null;
    if (includeMikser) {
      let toplamUretimKg = 0;
      for (const r of uretimKayitlari) {
        const gram = r.Gram || 0, gen = r.Genislik || 0, metre = r.MetreKg || 0;
        toplamUretimKg += (gram / 1000) * (gen / 1000) * metre;
      }
      const saatlikTuketim = toplamUretimKg / 8;
      const stokMap = {};
      for (const m of bekleyenMikserler) {
        stokMap[m.SemiProductType] = (stokMap[m.SemiProductType] || 0) + (m.ToplamKg || 0);
      }
      const esik = config.uyariEsikleri;
      stokTahmini = Object.entries(esik.hazirStokLimitleri || {}).map(([urunTipi, limit]) => {
        const mevcutKg  = stokMap[urunTipi] || 0;
        const kalanSaat = saatlikTuketim > 0 ? mevcutKg / saatlikTuketim : null;
        return { urunTipi, mevcutKg, kalanSaat, durum: mevcutKg < limit ? '⚠️' : '✅' };
      });
    }

    return vardiyaRaporuOlustur({
      vardiyaNo, baslangic, bitis,
      uretimKayitlari, hurdaKayitlari,
      beslemeKayitlari, aktifMikserler, bekleyenMikserler,
      includeMikser, stokTahmini, anlikUretim,
    });
  } catch (err) {
    return `❌ Rapor alınamadı: ${err.message}`;
  }
}

async function gunlukRaporuGetir(tarih, includeMikser = true) {
  try {
    const [uretimKayitlari, hurdaKayitlari, beslemeKayitlari, aktifMikserler, bekleyenMikserler] =
      await Promise.all([
        db.gunlukUretimGetir(tarih),
        db.gunlukHurdaGetir(tarih),
        db.gunlukBeslemeTuketimGetir(tarih),
        db.aktifMikserlerGetir(),
        db.bekleyenMikserlerGetir(),
      ]);

    return gunlukRaporuOlustur({
      tarih, uretimKayitlari, hurdaKayitlari,
      beslemeKayitlari, aktifMikserler, bekleyenMikserler,
      includeMikser,
    });
  } catch (err) {
    return `❌ Rapor alınamadı: ${err.message}`;
  }
}

async function haftalikRaporuGetir(baslangic, bitis, adminRaporu = false) {
  try {
    const bitisSorgu = new Date(bitis.getTime() + 1);
    const [uretimKayitlari, hurdaKayitlari] = await Promise.all([
      db.haftalikUretimGetir(baslangic, bitisSorgu),
      db.haftalikHurdaGetir(baslangic, bitisSorgu),
    ]);
    return haftalikRaporuOlustur({ baslangicTarih: baslangic, bitisTarih: bitis, uretimKayitlari, hurdaKayitlari, adminRaporu });
  } catch (err) {
    return `❌ Rapor alınamadı: ${err.message}`;
  }
}

async function aylikRaporuGetir(yil, ay, adminRaporu = false) {
  try {
    const baslangic = new Date(yil, ay - 1, 1, 0, 0, 0, 0);
    const bitis     = new Date(yil, ay,     1, 0, 0, 0, 0);  // sonraki ayın başı (exclusive)
    const [uretimKayitlari, hurdaKayitlari] = await Promise.all([
      db.haftalikUretimGetir(baslangic, bitis),
      db.haftalikHurdaGetir(baslangic, bitis),
    ]);
    return aylikRaporuOlustur({ yil, ay, uretimKayitlari, hurdaKayitlari, adminRaporu });
  } catch (err) {
    return `❌ Rapor alınamadı: ${err.message}`;
  }
}

// "itibariyle / itibari ile / itibaren / tarihinden..." → o tarihten bugüne anlamı
function aralikMi(soru) {
  return /itibar(?:iyle|i\s+ile|en)|(?:dan|den|tarihinden|tarihten)\s+itibaren|sonra(?:ki)?|bugüne\s+kadar/i.test(soru);
}

// Tarihli yapısal sorulara doğrudan DB'den cevap üret — LLM bypass
// Cevap oluşturulabilirse string, değilse null döner
async function yapilanSoruyaCevap(soru) {
  const tarihler = tarihTespit(soru);
  if (tarihler.length === 0) return null;

  const t   = tarihler[0];
  const etiket = tarihStr(t);
  const soruL  = soru.toLowerCase();
  const aralik = aralikMi(soru); // true → o tarihten bugüne, false → tek gün

  // ── Hat tespiti ──
  let hatFiltre = null;
  if (/ext-?1|jwell|birinci|1\.\s*hat|1\.\s*makine/i.test(soru)) hatFiltre = 'EXT-1';
  else if (/ext-?2|gwell|ikinci|2\.\s*hat|2\.\s*makine/i.test(soru)) hatFiltre = 'EXT-2';

  // ── GRAMAJ sorgusu ──
  // "460 gram", "455-470 gram aralığında", "460g" gibi ifadeleri yakala
  const gramajPattern = /(\d{2,4})\s*[-–]\s*(\d{2,4})\s*gram|(\d{2,4})\s*gr(?:am)?(?:\s*aralığında)?/i;
  const gramajEsle = soru.match(gramajPattern);
  if (gramajEsle) {
    let minGram, maxGram;
    if (gramajEsle[1] && gramajEsle[2]) {
      // Açık aralık: "455-470 gram"
      minGram = Number(gramajEsle[1]);
      maxGram = Number(gramajEsle[2]);
    } else {
      // Tek değer: "460 gram" → varsayılan ±5g tolerans
      const merkez = Number(gramajEsle[3]);
      // Soruda ayrıca açık aralık verilmişse onu kullan: "(455-470 gram)"
      const paranAralik = soru.match(/\((\d{2,4})\s*[-–]\s*(\d{2,4})\s*gram/i);
      if (paranAralik) {
        minGram = Number(paranAralik[1]);
        maxGram = Number(paranAralik[2]);
      } else {
        minGram = merkez - 5;
        maxGram = merkez + 5;
      }
    }

    let uretim;
    if (aralik) {
      // o tarihten bugüne
      const bugun = new Date(); bugun.setHours(23, 59, 59, 999);
      uretim = await db.haftalikUretimGetir(t, bugun).catch(() => []);
    } else {
      uretim = await db.gunlukUretimGetir(t).catch(() => []);
    }

    const filtreliUretim = uretim.filter(r => {
      const g = r.Gram || 0;
      const hatUygun = !hatFiltre || (config.hatlar[r.UretimHatti] || r.UretimHatti) === hatFiltre;
      return hatUygun && g >= minGram && g <= maxGram;
    });

    const hatMetni = hatFiltre ? ` (${hatFiltre})` : '';
    const donemMetni = aralik ? `${etiket}–bugün` : etiket;

    if (filtreliUretim.length === 0) {
      return `📅 *${donemMetni}${hatMetni}*\n  ${minGram}–${maxGram} gram aralığında üretim kaydı bulunamadı.`;
    }

    // Hat bazında grupla
    const hatGrup = {};
    for (const r of filtreliUretim) {
      const hat = config.hatlar[r.UretimHatti] || r.UretimHatti;
      if (!hatGrup[hat]) hatGrup[hat] = [];
      hatGrup[hat].push(r.Gram);
    }

    const satirlar = [`📅 *${donemMetni}${hatMetni} — Gramaj Sorgusu (${minGram}–${maxGram} g)*`];
    let topToplam = 0;
    for (const [hat, gramlar] of Object.entries(hatGrup).sort()) {
      const ort = (gramlar.reduce((a, b) => a + b, 0) / gramlar.length).toFixed(1);
      satirlar.push(`  ${hat}: *${gramlar.length} ürün*  |  Ort: ${ort} g`);
      topToplam += gramlar.length;
    }
    if (Object.keys(hatGrup).length > 1) satirlar.push(`  Toplam: *${topToplam} ürün*`);
    return satirlar.join('\n');
  }

  // ── MİKSER sorgusu ──
  if (/mikser/i.test(soruL)) {
    const mikserler = await db.gunlukMikserGetir(t).catch(() => []);
    if (mikserler.length === 0) return `📅 ${etiket} tarihinde mikser yükleme kaydı bulunamadı.`;

    const mikserMap = {};
    for (const m of mikserler) {
      const tip = m.SemiProductType || 'Bilinmiyor';
      mikserMap[tip] = (mikserMap[tip] || 0) + 1;
    }

    // Soruda belirli ürün tipi varsa sadece onu göster
    const istenenTipler = [];
    if (/epe\s*eva/i.test(soru)) istenenTipler.push('EPE EVA');
    if (/epe\s*poe/i.test(soru)) istenenTipler.push('EPE POE');

    const satirlar = [`📅 *${etiket} — Mikser Yüklemeleri*`];
    const gosterilecek = istenenTipler.length > 0
      ? Object.entries(mikserMap).filter(([tip]) => istenenTipler.some(i => tip.includes(i.replace('EPE ',''))))
      : Object.entries(mikserMap);

    for (const [tip, sayi] of gosterilecek.sort()) {
      satirlar.push(`  ${tip}: *${sayi} adet*`);
    }
    satirlar.push(`  Toplam: *${mikserler.length} lot*`);
    return satirlar.join('\n');
  }

  // ── EK ÜRÜN sorgusu ──
  if (/ek.?ürün|ekli.?ürün|ek.?adet/i.test(soruL)) {
    let uretim;
    if (aralik) {
      const bugun = new Date(); bugun.setHours(23, 59, 59, 999);
      uretim = await db.haftalikUretimGetir(t, bugun).catch(() => []);
    } else {
      uretim = await db.gunlukUretimGetir(t).catch(() => []);
    }
    const filtreliUretim = hatFiltre
      ? uretim.filter(r => (config.hatlar[r.UretimHatti] || r.UretimHatti) === hatFiltre)
      : uretim;
    const ekSayisi = filtreliUretim.filter(r => r.EkDurumu && r.EkDurumu !== 'null').length;
    const hatMetni = hatFiltre ? ` (${hatFiltre})` : '';
    const donemMetni = aralik ? `${etiket}–bugün` : etiket;
    return `📅 *${donemMetni}${hatMetni} — Ek Ürün*\n  ${ekSayisi} adet ekli ürün kayıt edildi.`;
  }

  // ── M² / METRE sorgusu ──
  if (/m²|m2|metre(?:kare)?|kaç.?m/i.test(soruL)) {
    let uretim;
    if (aralik) {
      const bugun = new Date(); bugun.setHours(23, 59, 59, 999);
      uretim = await db.haftalikUretimGetir(t, bugun).catch(() => []);
    } else {
      uretim = await db.gunlukUretimGetir(t).catch(() => []);
    }
    const filtreliUretim = hatFiltre
      ? uretim.filter(r => (config.hatlar[r.UretimHatti] || r.UretimHatti) === hatFiltre)
      : uretim;

    const hatMetni = hatFiltre ? ` ${hatFiltre}` : '';
    const donemMetni = aralik ? `${etiket}–bugün` : etiket;
    if (filtreliUretim.length === 0) {
      return `📅 ${donemMetni}${hatMetni} için üretim kaydı bulunamadı.`;
    }

    const uHatlar = uretimOzetle(filtreliUretim);
    const satirlar = [`📅 *${donemMetni}${hatMetni} — Üretim (m²)*`];
    let topM2 = 0;
    for (const [hat, u] of Object.entries(uHatlar)) {
      satirlar.push(`  ${hat}: *${u.toplamM2.toFixed(0)} m²*  (${u.tamUrun + u.ekliUrun + u.eksikUrun} ürün)`);
      topM2 += u.toplamM2;
    }
    if (Object.keys(uHatlar).length > 1) satirlar.push(`  Toplam: *${topM2.toFixed(0)} m²*`);
    return satirlar.join('\n');
  }

  return null; // Tanımlanamayan sorgu → LLM'e bırak
}

// Metinden DD.MM.YYYY formatındaki tarihleri çıkar
function tarihTespit(metin) {
  const pattern = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g;
  const tarihler = [];
  let m;
  while ((m = pattern.exec(metin)) !== null) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (!isNaN(d.getTime())) tarihler.push(d);
  }
  return tarihler;
}

// Belirli tarihler için DB'den veri çekip LLM bağlamı oluştur
async function belirliTarihBaglam(tarihler) {
  const s = [];
  for (const tarih of tarihler) {
    const etiket = tarihStr(tarih);
    const [uretimKayitlari, hurdaKayitlari, beslemeKayitlari, mikserler] = await Promise.all([
      db.gunlukUretimGetir(tarih).catch(() => []),
      db.gunlukHurdaGetir(tarih).catch(() => []),
      db.gunlukBeslemeTuketimGetir(tarih).catch(() => []),
      db.gunlukMikserGetir(tarih).catch(() => []),
    ]);

    s.push(...gunBaglamYaz(etiket, uretimKayitlari, hurdaKayitlari, beslemeKayitlari));

    // Ek ürün sayısı
    const ekSayisi = uretimKayitlari.filter(r => r.EkDurumu && r.EkDurumu !== 'null').length;
    s.push(`  Ek ürün sayısı: ${ekSayisi}`);

    // Mikser yüklemeleri ürün tipine göre
    if (mikserler.length > 0) {
      const mikserMap = {};
      for (const m of mikserler) {
        const tip = m.SemiProductType || 'Bilinmiyor';
        mikserMap[tip] = (mikserMap[tip] || 0) + 1;
      }
      const mikserOzet = Object.entries(mikserMap)
        .map(([tip, sayi]) => `${tip}: ${sayi} adet`)
        .join(', ');
      s.push(`  Mikser yüklemeleri: ${mikserOzet} — toplam ${mikserler.length} lot`);
    } else {
      s.push(`  Mikser yüklemeleri: kayıt bulunamadı`);
    }
  }
  return s.join('\n');
}

// ── LLM yardımcı: üretim verisi + ilgili prosedür ile yanıt üret ──
async function llmYanit(tel, soru) {
  try {
    // Tarihli yapısal sorulara doğrudan cevap ver — LLM bypass
    const dogrudan = await yapilanSoruyaCevap(soru);
    if (dogrudan) return dogrudan;

    // Soruda belirli tarih(ler) varsa o tarihlerin verisini ek olarak çek
    const tespiEdilen = tarihTespit(soru);
    const [baglamMetni, prosedurMetni, ekBaglamMetni] = await Promise.all([
      llmBaglamOlustur(),
      Promise.resolve(ilgiliBelgeleriGetir(soru)),
      tespiEdilen.length > 0 ? belirliTarihBaglam(tespiEdilen) : Promise.resolve(''),
    ]);

    const hafizaMetni = hafizaOku();
    const qaMetni     = ilgiliQAlariGetir(soru);
    const tamBaglam = [
      baglamMetni,
      ekBaglamMetni   ? '\n=== SORGULANAN TARİH VERİLERİ ===\n' + ekBaglamMetni : '',
      prosedurMetni   ? '\n=== İLGİLİ PROSEDÜR ===\n' + prosedurMetni            : '',
      qaMetni         ? '\n=== İLGİLİ SORU-CEVAPLAR ===\n' + qaMetni             : '',
      hafizaMetni     ? '\n=== KAYDEDILEN BİLGİLER ===\n' + hafizaMetni           : '',
    ].filter(Boolean).join('\n');

    return await llmSor(tel, soru, tamBaglam);
  } catch (err) {
    console.error('❌ LLM hatası:', err.message);
    return '❌ AI yanıt veremedi. Rapor almak için *rapor* yaz.';
  }
}

// uretimOzetle çıktısından toplam m², kg, fire hesapla
function toplamHesapla(uHatlar, hHatlar) {
  let topM2 = 0, topKg = 0, topHurda = 0, topRecycle = 0, topLabFire = 0;
  for (const u of Object.values(uHatlar)) {
    topM2      += u.toplamM2;
    topKg      += u.toplamUretimKg;
    topLabFire += u.labFire || 0;
  }
  for (const h of Object.values(hHatlar)) {
    topHurda   += h.hurda;
    topRecycle += h.recycle + (h.sarim || 0);
  }
  const topFire   = topHurda + topRecycle + topLabFire;
  const topGirdi  = topKg + topFire;
  const fireOrani = topGirdi > 0 ? (topFire / topGirdi) * 100 : null;
  return { topM2, topKg, topFire, fireOrani };
}

// Bir gün verisini bölüm başlığı + detay satırları olarak yaz
function gunBaglamYaz(etiket, uretimKayitlari, hurdaKayitlari, beslemeKayitlari = []) {
  const s = [];
  s.push(`\n=== ${etiket} ===`);

  if (uretimKayitlari.length === 0) {
    s.push('Üretim kaydı bulunamadı.');
    return s;
  }

  const uHatlar = uretimOzetle(uretimKayitlari);
  const hHatlar = hurdaOzetle(hurdaKayitlari);
  const { topM2, topKg, topFire, fireOrani } = toplamHesapla(uHatlar, hHatlar);

  s.push(`Toplam üretim : ${topM2.toFixed(0)} m²  |  ${topKg.toFixed(0)} kg  |  ${uretimKayitlari.length} kayıt`);
  if (fireOrani !== null) s.push(`Fire oranı    : %${fireOrani.toFixed(2)}  (${topFire.toFixed(1)} kg fire)`);

  // Hat bazında detay
  for (const [hat, u] of Object.entries(uHatlar)) {
    const h   = hHatlar[hat] || { hurda: 0, recycle: 0, sarim: 0 };
    const labF = u.labFire || 0;
    const hFire = h.hurda + h.recycle + (h.sarim || 0) + labF;
    const hGirdi = u.toplamUretimKg + hFire;
    const hFO   = hGirdi > 0 ? (hFire / hGirdi * 100).toFixed(2) : '-';
    const toplam = u.tamUrun + u.ekliUrun + u.eksikUrun;
    s.push(`  ${hat}: ${u.toplamM2.toFixed(0)} m²  |  ${toplam} ürün  |  Fire: %${hFO}${u.eksikUrun > 0 ? `  |  ⚠️ ${u.eksikUrun} eksik` : ''}`);
  }

  // Vardiya bazında detay (aynı gün içinde saate göre böl)
  const vardiyaDilimleri = [
    { no: 1, basH: 0,  bitH: 8  },
    { no: 2, basH: 8,  bitH: 16 },
    { no: 3, basH: 16, bitH: 24 },
  ];
  for (const v of vardiyaDilimleri) {
    const vU = uretimKayitlari.filter(r => {
      const h = new Date(r.BitisSaati).getUTCHours();
      return h >= v.basH && h < v.bitH;
    });
    if (vU.length === 0) continue;
    const amir  = vardiyaAmiriBul(vU, v.no);
    const vuHat = uretimOzetle(vU);
    const { topM2: vM2 } = toplamHesapla(vuHat, {});
    s.push(`  V${v.no} (${String(v.basH).padStart(2,'0')}:00-${String(v.bitH).padStart(2,'0')}:00)  Amir: ${amir}  |  ${vM2.toFixed(0)} m²  |  ${vU.length} kayıt`);
  }

  // Besleme tüketimi
  if (beslemeKayitlari.length > 0) {
    const besleme = beslemeKayitlari.map(b => `${b.SemiProductType}: ${(b.ToplamKg||0).toFixed(0)} kg`).join(', ');
    s.push(`Besleme tüketimi: ${besleme}`);
  }

  return s;
}

// Tüm DB verilerini çekip LLM için kapsamlı metin bağlamı oluştur
async function llmBaglamOlustur() {
  // DB'ye ulaşılamazsa boş bağlam döndür — LLM yine de çalışır
  const dbVar = await db.baglantiVarMi();
  if (!dbVar) {
    console.log('⚠️  LLM bağlamı: DB erişilemez, verisize modda çalışıyor.');
    return 'VERİTABANI BAĞLANTISI YOK — Şu an şirket ağı dışındasın. Anlık üretim verisi alınamıyor.';
  }

  try {
    const simdi = new Date();
    const bugun = new Date(simdi); bugun.setHours(0, 0, 0, 0);
    const dun   = new Date(bugun); dun.setDate(dun.getDate() - 1);
    const yediGunOnce = new Date(bugun); yediGunOnce.setDate(yediGunOnce.getDate() - 7);

    // Tüm sorguları paralel çalıştır
    const [
      bugunUretim, bugunHurda, bugunBesleme,
      dunUretim,   dunHurda,   dunBesleme,
      haftaUretim, haftaHurda,
      aktifMikserler, bekleyenMikserler,
      anlikHam,
    ] = await Promise.all([
      db.gunlukUretimGetir(bugun).catch(() => []),
      db.gunlukHurdaGetir(bugun).catch(() => []),
      db.gunlukBeslemeTuketimGetir(bugun).catch(() => []),
      db.gunlukUretimGetir(dun).catch(() => []),
      db.gunlukHurdaGetir(dun).catch(() => []),
      db.gunlukBeslemeTuketimGetir(dun).catch(() => []),
      db.haftalikUretimGetir(yediGunOnce, bugun).catch(() => []),
      db.haftalikHurdaGetir(yediGunOnce, bugun).catch(() => []),
      db.aktifMikserlerGetir().catch(() => []),
      db.bekleyenMikserlerGetir().catch(() => []),
      db.anlikUretimDurumuGetir().catch(() => []),
    ]);

    const s = [];
    s.push(`Saat:${pad2(simdi.getHours())}:${pad2(simdi.getMinutes())} Bugün:${tarihStr(bugun)} Dün:${tarihStr(dun)}`);

    // Bugün
    s.push(...gunBaglamYaz(`BUGÜN (${tarihStr(bugun)}) — Mevcut`, bugunUretim, bugunHurda, bugunBesleme));

    // Dün
    s.push(...gunBaglamYaz(`DÜN (${tarihStr(dun)}) — Tamamlandı`, dunUretim, dunHurda, dunBesleme));

    // Son 7 gün özeti — gün bazında grupla
    s.push(`\n=== SON 7 GÜN (${tarihStr(yediGunOnce)} – ${tarihStr(new Date(bugun.getTime()-86400000))}) ===`);
    if (haftaUretim.length > 0) {
      const gunMap = {};
      for (const r of haftaUretim) {
        const d = new Date(r.UretimTarihi);
        const key = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
        if (!gunMap[key]) gunMap[key] = { u: [], h: [] };
        gunMap[key].u.push(r);
      }
      for (const r of haftaHurda) {
        const d = new Date(r.KayitTarihi);
        const key = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
        if (gunMap[key]) gunMap[key].h.push(r);
      }
      let haftaTopM2 = 0, haftaTopKg = 0;
      for (const key of Object.keys(gunMap).sort()) {
        const { u, h } = gunMap[key];
        const uH = uretimOzetle(u);
        const hH = hurdaOzetle(h);
        const { topM2, topKg, fireOrani } = toplamHesapla(uH, hH);
        haftaTopM2 += topM2;
        haftaTopKg += topKg;
        const [, ay, gun] = key.split('-');
        const fireStr = fireOrani !== null ? `  Fire: %${fireOrani.toFixed(1)}` : '';
        s.push(`  ${gun}.${ay}: ${topM2.toFixed(0)} m²  |  ${topKg.toFixed(0)} kg${fireStr}`);
      }
      s.push(`  TOPLAM 7 GÜN: ${haftaTopM2.toFixed(0)} m²  |  ${haftaTopKg.toFixed(0)} kg`);
      s.push(`  GÜNLÜK ORTALAMA: ${(haftaTopM2 / 7).toFixed(0)} m²`);

      // Vardiya amiri performansı (haftalık)
      const amirMap = {};
      for (const r of haftaUretim) {
        const v = r.Vardiya; if (!v) continue;
        if (!amirMap[v]) amirMap[v] = { m2: 0, kg: 0, labFire: 0 };
        const metre = r.MetreKg||0, gram = r.Gram||0, gen = r.Genislik||0;
        amirMap[v].m2      += metre * gen / 1000;
        amirMap[v].kg      += (gram/1000) * (gen/1000) * metre;
        amirMap[v].labFire += (gram/1000) * (gen/1000);
      }
      for (const r of haftaHurda) {
        const v = r.Vardiya; if (!v || !amirMap[v]) continue;
        amirMap[v].hurda   = (amirMap[v].hurda||0) + (r.EriyikHurda||0) + (r.HaliHurda||0) + (r.RuloHurda||0);
        amirMap[v].recycle = (amirMap[v].recycle||0) + (r.HaliRecycle||0) + (r.RuloRecycle||0) + (r.Sarim||0);
      }
      if (Object.keys(amirMap).length > 0) {
        s.push('  Vardiya amiri performansı (7 gün):');
        for (const [harf, a] of Object.entries(amirMap).sort()) {
          const tFire  = (a.hurda||0) + (a.recycle||0) + (a.labFire||0);
          const tGirdi = a.kg + tFire;
          const fO     = tGirdi > 0 ? (tFire/tGirdi*100).toFixed(1) : '-';
          const amir   = config.vardiyaAmirleri[harf] || harf;
          s.push(`    ${amir} (${harf}): ${a.m2.toFixed(0)} m²  |  Fire: %${fO}`);
        }
      }
    } else {
      s.push('Son 7 gün için üretim kaydı bulunamadı.');
    }

    // Anlık üretim — her hat için son 5 kayıt (ürün, gramaj, genişlik)
    s.push('\n=== ANLK ÜRETİM DURUMU (son kayıtlar) ===');
    if (anlikHam.length > 0) {
      const hatGruplari = {};
      for (const r of anlikHam) {
        const hat = config.hatlar[r.UretimHatti] || r.UretimHatti;
        if (!hatGruplari[hat]) hatGruplari[hat] = [];
        hatGruplari[hat].push(r);
      }
      for (const [hat, kayitlar] of Object.entries(hatGruplari)) {
        const ilk = kayitlar[0];
        const gramlar = kayitlar.map(r => r.Gram).filter(Boolean);
        const genislikler = kayitlar.map(r => r.Genislik).filter(Boolean);
        const ortGram = gramlar.length ? (gramlar.reduce((a,b) => a+b, 0) / gramlar.length).toFixed(0) : '-';
        const ortGenislik = genislikler.length ? (genislikler.reduce((a,b) => a+b, 0) / genislikler.length).toFixed(0) : '-';
        s.push(`  ${hat}: Ürün="${ilk.Urun || '-'}"  Lot=${ilk.LotNumarasi || '-'}  Gramaj=${ortGram}g  Genişlik=${ortGenislik}mm  (son ${kayitlar.length} kayıt ortalaması)`);
      }
    } else {
      s.push('  Anlık üretim verisi bulunamadı.');
    }

    // Mikser & stok
    s.push('\n=== MİKSER & STOK DURUMU ===');
    if (aktifMikserler.length > 0) {
      s.push(`Şu an aktif mikserler (${aktifMikserler.length}):`);
      for (const m of aktifMikserler) {
        s.push(`  Mikser ${m.MixerLine} | ${m.SemiProductType} | ${(m.TotalKg||0).toFixed(0)} kg`);
      }
    } else {
      s.push('Şu an aktif mikser yok.');
    }
    if (bekleyenMikserler.length > 0) {
      s.push('Hazır stok (bekleyen):');
      for (const m of bekleyenMikserler) {
        const limit = config.uyariEsikleri.hazirStokLimitleri?.[m.SemiProductType];
        const durum = limit && m.ToplamKg < limit ? ' ⚠️ LİMİT ALTI' : '';
        s.push(`  ${m.SemiProductType}: ${(m.ToplamKg||0).toFixed(0)} kg  (${m.MikserSayisi} mikser)${durum}`);
      }
    } else {
      s.push('Hazır stok yok.');
    }

    return s.join('\n');
  } catch (err) {
    console.error('LLM bağlam hatası:', err.message);
    return 'VERİTABANI HATASI — Anlık üretim verisi alınamadı.';
  }
}

module.exports = { mesajiIsle, anaMenuMesaji, botMesaji };

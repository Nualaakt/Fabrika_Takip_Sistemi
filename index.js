// ══════════════════════════════════════════════════════════════
//  index.js  –  Ana servis
//
//  Kullanım:
//    node index.js                → zamanlanmış mod (her vardiya sonu otomatik)
//    node index.js --son-vardiya  → en son tamamlanan vardiyayı hemen gönder
//    node index.js --vardiya-1    → bugünün Vardiya 1 (00:00-08:00) raporunu gönder
//    node index.js --vardiya-2    → bugünün Vardiya 2 (08:00-16:00) raporunu gönder
//    node index.js --vardiya-3    → bugünün Vardiya 3 (16:00-00:00) raporunu gönder
//    node index.js --gunluk        → dünün günlük raporunu gönder
//    node index.js --gunluk YYYY-MM-DD → belirtilen günün raporunu gönder
// ══════════════════════════════════════════════════════════════

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode  = require('qrcode-terminal');
const cron    = require('node-cron');

const config  = require('./config');
const db      = require('./db');
const ku      = require('./kullanicilar');
const { vardiyaRaporuOlustur, gunlukRaporuOlustur, haftalikRaporuOlustur, aylikRaporuOlustur, anlikUretimOzetle } = require('./rapor');
const { mesajiIsle, anaMenuMesaji, botMesaji } = require('./menu');

// ── Kayıt oturumları (multi-turn) ─────────────────────────────
// chatId → { asama: 'isim'|'pozisyon'|'birim', isim, pozisyon }
const kayitOturumlari = {};

// Admin onay bekleme durumu
// adminChatId → { kayitId }
const onayBekleyen = {};

// ── Komut satırı parametresi ──────────────────────────────────
const args = process.argv.slice(2);
const MOD = args[0] || '--zamanli';
// Opsiyonel: node index.js --vardiya-2 2026-05-07
// new Date('2026-05-07') UTC midnight parse eder → GMT+3'te bir gün geri kayar.
// Çözüm: parçalara ayırıp lokal Date oluştur.
function tarihParse(str) {
  const [yil, ay, gun] = str.split('-').map(Number);
  return new Date(yil, ay - 1, gun, 0, 0, 0, 0);
}
const TARIH_ARG = args[1] ? tarihParse(args[1]) : null;
if (TARIH_ARG && isNaN(TARIH_ARG)) {
  console.error('❌ Geçersiz tarih formatı. Örnek: 2026-05-07');
  process.exit(1);
}

// ── WhatsApp istemcisi ────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', (qr) => {
  console.log('\n📱 QR kodu tara:\n');
  qrcode.generate(qr, { small: true });
  console.log('\nTelefon → WhatsApp → Bağlı Cihazlar → Cihaz Ekle\n');
});

client.on('auth_failure', () => {
  console.error('❌ Kimlik doğrulama başarısız.');
  process.exit(1);
});

// ── Mesaj gönder ─────────────────────────────────────────────
// roller: undefined → herkese gönder
// roller: ['admin'] → yalnızca admin rolüne gönder
async function mesajGonder(metin, roller) {
  const hedefler = (roller
    ? config.alicilar.filter(a => roller.includes(a.rol))
    : config.alicilar
  ).filter(a => a.aktif !== false);

  for (const alici of hedefler) {
    try {
      // gid → grup  |  tel → bireysel kişi  |  lid → WhatsApp iç ID
      const hedefId = alici.gid
        ? alici.gid
        : alici.tel + '@c.us';
      await client.sendMessage(hedefId, metin);
      console.log(`✓ Gönderildi → ${alici.isim} (${alici.rol})`);
      await bekle(1500);
    } catch (err) {
      console.error(`✕ HATA → ${alici.isim}: ${err.message}`);
    }
  }

  // ── Dinamik kayıtlı kullanıcılar ────────────────────────────
  if (roller) {
    for (const rol of roller) {
      if (rol === 'admin') continue; // admin her zaman config'den
      const kayitlilar = ku.aktifKullanicilar(rol);
      for (const kul of kayitlilar) {
        try {
          await client.sendMessage(kul.chatId, metin);
          console.log(`✓ Gönderildi → ${kul.isim} [kayıtlı] (${kul.birim})`);
          await bekle(1500);
        } catch (err) {
          console.error(`✕ HATA → ${kul.isim} [kayıtlı]: ${err.message}`);
        }
      }
    }
  }
}

function bekle(ms) { return new Promise(r => setTimeout(r, ms)); }

function sureFmt(dakika) {
  const dk = Math.round(dakika);
  if (dk < 60) return `${dk} dk`;
  const sa = Math.floor(dk / 60);
  const kalan = dk % 60;
  return kalan > 0 ? `${sa} sa ${kalan} dk` : `${sa} sa`;
}

// Üretim + hurda kayıtlarından özet metrikler hesaplar
function hesaplaOzet(uretimKayitlari, hurdaKayitlari) {
  let toplamM2 = 0, toplamUretimKg = 0, topHurda = 0, topRecycle = 0;
  for (const r of uretimKayitlari) {
    const gram = r.Gram || 0, gen = r.Genislik || 0, metre = r.MetreKg || 0;
    toplamM2       += metre * gen / 1000;
    toplamUretimKg += (gram / 1000) * (gen / 1000) * metre;
    topRecycle     += (gram / 1000) * (gen / 1000); // lab fire (1m numune)
  }
  for (const r of hurdaKayitlari) {
    topHurda   += (r.EriyikHurda || 0) + (r.HaliHurda || 0) + (r.RuloHurda || 0);
    topRecycle += (r.HaliRecycle || 0) + (r.RuloRecycle || 0) + (r.Sarim || 0);
  }
  const topFire  = topHurda + topRecycle;
  const topGirdi = toplamUretimKg + topFire;
  return { toplamM2, toplamUretimKg, fireOrani: topGirdi > 0 ? (topFire / topGirdi) * 100 : 0 };
}

async function mesajGonderAdmin(metin) {
  return mesajGonder(metin, ['admin']);
}

// ── Anlık İzleme Durumu ───────────────────────────────────────
//
//  Bot yeniden başlatılınca sıfırlanır — kasıtlı.
//  Restart sonrası eski kayıtlar için tekrar uyarı gitmesin diye
//  sonBilinenSiraNo başlangıçta DB'deki mevcut max SiraNo'ya set edilir.
//
const izlemeState = {
  uretimDurdu:           false,      // Şu an "üretim durdu" uyarısı aktif mi?
  bildirilmisEksikler:   new Set(),  // Uyarısı gönderilmiş EksikMetraj SiraNo'ları
  ekUrunUyariAktif:      false,      // Ek ürün eşiği şu an aşıldı mı?
  sonBilinenSiraNo:      null,       // null = henüz init edilmedi
};

async function anlikIzlemeKontrol() {
  const izleme = config.anlikIzleme;
  if (!izleme?.aktif) return;

  // Başlangıç: mevcut max SiraNo'yu kur; eski kayıtlara uyarı gitmesin
  if (izlemeState.sonBilinenSiraNo === null) {
    try {
      const ilk = await db.enSonKayitGetir();
      izlemeState.sonBilinenSiraNo = ilk?.SiraNo ?? 0;
      console.log(`📍 Anlık izleme init: son SiraNo #${izlemeState.sonBilinenSiraNo}`);
    } catch (e) {
      izlemeState.sonBilinenSiraNo = 0;
    }
    return; // İlk çalışmada sadece init; bir sonraki döngüde kontrol başlar
  }

  try {
    // ── 1. ÜRETİM DURUŞ KONTROLÜ ─────────────────────────────
    const sonKayit = await db.enSonKayitGetir();
    if (sonKayit) {
      const dakika = sonKayit.DakikaFarki;

      if (dakika >= izleme.uretimDurmaEsigi && !izlemeState.uretimDurdu) {
        izlemeState.uretimDurdu = true;
        const uyari = [
          '🔴 *ÜRETİM DURUŞ UYARISI*',
          `⏱️ Son *${dakika} dakika* boyunca yeni üretim kaydı yok.`,
          `📍 Son bilinen kayıt: #${sonKayit.SiraNo} (${config.hatlar[sonKayit.UretimHatti] || sonKayit.UretimHatti})`,
          '─────────────────────────',
          '_Capssun Takip Sistemi_',
        ].join('\n');
        await mesajGonderAdmin(uyari);
        console.log(`🔴 Üretim duruş uyarısı gönderildi (${dakika} dk, SiraNo #${sonKayit.SiraNo}).`);

      } else if (dakika < izleme.uretimDurmaEsigi && izlemeState.uretimDurdu) {
        izlemeState.uretimDurdu = false;
        const bilgi = [
          '✅ *ÜRETİM YENİDEN BAŞLADI*',
          `📍 SiraNo #${sonKayit.SiraNo} (${config.hatlar[sonKayit.UretimHatti] || sonKayit.UretimHatti})`,
          '_Capssun Takip Sistemi_',
        ].join('\n');
        await mesajGonderAdmin(bilgi);
        console.log(`✅ Üretim yeniden başladı bildirimi gönderildi.`);
      }
    }

    // ── 2. YENİ KAYITLARI TARA ───────────────────────────────
    const yeniKayitlar = await db.yeniKayitlarGetir(izlemeState.sonBilinenSiraNo);

    if (yeniKayitlar.length > 0) {
      izlemeState.sonBilinenSiraNo = Math.max(...yeniKayitlar.map(r => r.SiraNo));

      // ── 2a. EKSİK METRAJ ─────────────────────────────────────
      const yeniEksikler = yeniKayitlar.filter(r =>
        (r.EksikMetraj === true || r.EksikMetraj === 1) &&
        !izlemeState.bildirilmisEksikler.has(r.SiraNo)
      );
      for (const r of yeniEksikler) {
        izlemeState.bildirilmisEksikler.add(r.SiraNo);
        const hat = config.hatlar[r.UretimHatti] || r.UretimHatti;
        const uyari = [
          '🟠 *EKSİK METRAJ TESPİT EDİLDİ*',
          `📍 Hat: *${hat}*  |  Lot: ${r.LotNumarasi || '-'}`,
          `🔢 SiraNo: #${r.SiraNo}`,
          '─────────────────────────',
          '_Capssun Takip Sistemi_',
        ].join('\n');
        await mesajGonder(uyari, ['admin', 'uretim']);
        console.log(`🟠 Eksik metraj uyarısı: SiraNo #${r.SiraNo}, Hat: ${hat}`);
      }
    }

    // ── 3. EK ÜRÜN ROLLING WINDOW ────────────────────────────
    const sonN      = await db.sonNKayitGetir(izleme.sonKacUrunBaksin);
    const ekSayisi  = sonN.filter(r => r.EkDurumu && r.EkDurumu !== '').length;

    if (ekSayisi > izleme.ekUrunEsigi && !izlemeState.ekUrunUyariAktif) {
      izlemeState.ekUrunUyariAktif = true;
      const uyari = [
        '🟡 *EK ÜRÜN ARTIŞI UYARISI*',
        `📊 Son *${izleme.sonKacUrunBaksin}* kayıtta *${ekSayisi}* ek ürün tespit edildi (eşik: ${izleme.ekUrunEsigi}).`,
        '─────────────────────────',
        '_Capssun Takip Sistemi_',
      ].join('\n');
      await mesajGonder(uyari, ['admin', 'uretim']);
      console.log(`🟡 Ek ürün uyarısı: son ${izleme.sonKacUrunBaksin} kayıtta ${ekSayisi} adet.`);

    } else if (ekSayisi <= izleme.ekUrunEsigi && izlemeState.ekUrunUyariAktif) {
      // Eşiğin altına indi — state sıfırla, bir sonraki aşımda tekrar uyarsın
      izlemeState.ekUrunUyariAktif = false;
    }

  } catch (err) {
    console.error('❌ Anlık izleme hatası:', err.message);
  }
}

// ── Mikser İzleme Durumu ─────────────────────────────────────
//
//  Startup'ta mevcut durumu sessizce kaydeder (baseline), uyarı göndermez.
//  Sadece baseline'dan SONRA gelen değişiklikler uyarı tetikler:
//    - Yeni MixerLoading kaydı → yüklendi uyarısı
//    - Bekleyen lot'un silo sayısı baseline üstüne çıktı → boşaltma başladı
//    - 10 dk yeni silo gelmedi → boşaltma tamamlandı
//
const mikserIzlemeState = {
  ilkCalisma:         true,
  bilinenLotlar:      new Set(),  // Görülen tüm MixerLoading LotNo'ları
  initSiloSayilari:   {},         // LotNo → startup anındaki silo sayısı (baseline)
  bosaltilanLotlar:   {},         // LotNo → aktif boşaltma takibi
  tamamlananLotlar:   new Set(),  // Tamamlandı bildirimi gönderilmiş LotNo'lar
  yuklemZamanlari:    {},         // LotNo → yükleme zamanı (MixerLoading.CreatedAt)
  dozajBaslayanLotlar: new Set(), // Dozajlama başladı bildirimi gönderilmiş LotNo'lar
  dozajBitenLotlar:    new Set(), // Dozajlama tamamlandı bildirimi gönderilmiş LotNo'lar
};

// SemiProductType'tan kısa ürün adı: "EPE POE" → "POE"
function urunKisaAd(tip) {
  return (tip || '').replace(/^EPE\s*/i, '').trim() || tip;
}

// ── Kayıt oturumu çok adımlı akış ────────────────────────────
async function kayitOturumuIsle(gonderenId, hedefAdres, metin) {
  const oturum = kayitOturumlari[gonderenId];
  if (!oturum) return;

  if (oturum.asama === 'isim') {
    oturum.isim  = metin.trim();
    oturum.asama = 'birim';
    await client.sendMessage(hedefAdres,
      '🏭 Hangi birimde çalışıyorsunuz?\n\n1️⃣ Üretim\n2️⃣ Mikser\n3️⃣ Bakım\n4️⃣ Depo\n5️⃣ Kalite'
    );

  } else if (oturum.asama === 'birim') {
    const birim = ku.birimCoz(metin);
    if (!birim) {
      await client.sendMessage(hedefAdres,
        '⚠️ Geçersiz seçim. Lütfen 1-5 arasında bir numara yazın:\n\n1️⃣ Üretim  2️⃣ Mikser  3️⃣ Bakım  4️⃣ Depo  5️⃣ Kalite'
      );
      return;
    }
    delete kayitOturumlari[gonderenId];

    const kayit = ku.bekleyenEkle({
      isim:     oturum.isim,
      pozisyon: ku.pozisyonCoz(birim),
      birim,
      chatId:   hedefAdres,
    });

    await client.sendMessage(hedefAdres,
      '✅ *Kaydınız alındı!*\nAdmin onayı bekleniyor, kısa süre içinde bildirim alacaksınız.\n_Capssun Takip Sistemi_'
    );

    // Admin'e bildir
    const s = [
      `🔔 *Yeni Kayıt Talebi — #${kayit.id}*`,
      '─────────────────────────',
      `👤 İsim     : ${kayit.isim}`,
      `💼 Pozisyon : ${kayit.pozisyon}`,
      `🏭 Birim    : ${kayit.birim}`,
      '─────────────────────────',
      `Onaylamak : //onayla ${kayit.id}`,
      `Reddetmek : //reddet ${kayit.id}`,
    ].join('\n');
    await mesajGonderAdmin(s);
    console.log(`📋 Yeni kayıt talebi: #${kayit.id} — ${kayit.isim}`);
  }
}

async function mikserIzlemeKontrol() {
  const ilkCalisma = mikserIzlemeState.ilkCalisma;

  try {
    // ── 1. MİKSER YÜKLEMELERİ ───────────────────────────────
    const yuklemeler = await db.mikserYuklemelerGetir();

    for (const m of yuklemeler) {
      // ── Yeni lot tespiti ──────────────────────────────────────
      if (!mikserIzlemeState.bilinenLotlar.has(m.LotNo)) {
        mikserIzlemeState.bilinenLotlar.add(m.LotNo);
        // MixerLoading.CreatedAt TR saati olarak saklanıyor, mssql UTC gibi okur → 3 saat düzelt
        mikserIzlemeState.yuklemZamanlari[m.LotNo] = new Date(new Date(m.CreatedAt).getTime() - 3 * 3600000);

        if (!ilkCalisma) {
          const mesaj = [
            `🔵 *Mikser ${m.MixerLine} — ${urunKisaAd(m.SemiProductType)} Yüklenmeye Başladı*`,
            `🔢 Lot: \`${m.LotNo}\``,
            '_Capssun Takip Sistemi_',
          ].join('\n');
          await mesajGonder(mesaj, ['admin', 'mikser']);
          console.log(`🔵 Mikser yüklendi: ${m.MixerLine} / ${m.LotNo}`);
        }
      }

      // ── Dozajlama başladı tespiti ─────────────────────────────
      if (m.DozajBaslangicZamani && !mikserIzlemeState.dozajBaslayanLotlar.has(m.LotNo)) {
        mikserIzlemeState.dozajBaslayanLotlar.add(m.LotNo);
        if (!ilkCalisma) {
          const pad2l     = n => String(n).padStart(2, '0');
          const dozajBasZ = new Date(new Date(m.DozajBaslangicZamani).getTime() - 3 * 3600000);
          const yuklemZ   = mikserIzlemeState.yuklemZamanlari[m.LotNo];
          const s = [
            `⚗️ *Mikser ${m.MixerLine} — ${urunKisaAd(m.SemiProductType)} Dozajlama Başladı*`,
            `🔢 Lot: \`${m.LotNo}\``,
          ];
          if (yuklemZ) {
            const yuklemSure = sureFmt((dozajBasZ - yuklemZ) / 60000);
            const yuklemSa   = `${pad2l(yuklemZ.getHours())}:${pad2l(yuklemZ.getMinutes())}`;
            const dozajSa    = `${pad2l(dozajBasZ.getHours())}:${pad2l(dozajBasZ.getMinutes())}`;
            s.push(`⏱️ Yükleme süresi: *${yuklemSure}* (${yuklemSa} → ${dozajSa})`);
          }
          s.push('_Capssun Takip Sistemi_');
          await mesajGonder(s.join('\n'), ['admin', 'mikser']);
          console.log(`⚗️ Dozajlama başladı: ${m.MixerLine} / ${m.LotNo}`);
        }
      }

      // ── Dozajlama tamamlandı tespiti ──────────────────────────
      if (m.DozajBitisZamani && !mikserIzlemeState.dozajBitenLotlar.has(m.LotNo)) {
        mikserIzlemeState.dozajBitenLotlar.add(m.LotNo);
        if (!ilkCalisma) {
          const pad2l     = n => String(n).padStart(2, '0');
          const dozajBitZ = new Date(new Date(m.DozajBitisZamani).getTime() - 3 * 3600000);
          const dozajBasZ = m.DozajBaslangicZamani
            ? new Date(new Date(m.DozajBaslangicZamani).getTime() - 3 * 3600000)
            : null;
          const s = [
            `✅ *Mikser ${m.MixerLine} — ${urunKisaAd(m.SemiProductType)} Dozajlama Tamamlandı*`,
            `🔢 Lot: \`${m.LotNo}\``,
          ];
          if (dozajBasZ) {
            const dozajSure = sureFmt((dozajBitZ - dozajBasZ) / 60000);
            const basSa     = `${pad2l(dozajBasZ.getHours())}:${pad2l(dozajBasZ.getMinutes())}`;
            const bitSa     = `${pad2l(dozajBitZ.getHours())}:${pad2l(dozajBitZ.getMinutes())}`;
            s.push(`⏱️ Dozajlama süresi: *${dozajSure}* (${basSa} → ${bitSa})`);
          }
          s.push('_Capssun Takip Sistemi_');
          await mesajGonder(s.join('\n'), ['admin', 'mikser']);
          console.log(`✅ Dozajlama tamamlandı: ${m.MixerLine} / ${m.LotNo}`);
        }
      }
    }

    // ── 2. BOŞALTMA TAKİBİ ───────────────────────────────────
    const bekleyenler = await db.bekleyenMikserSilolariGetir();

    for (const b of bekleyenler) {
      if (mikserIzlemeState.tamamlananLotlar.has(b.MixerLotNo)) continue;

      if (ilkCalisma) {
        // Startup: mevcut silo sayısını baseline olarak kaydet, takip etme
        mikserIzlemeState.initSiloSayilari[b.MixerLotNo] = b.SiloSayisi;
        continue;
      }

      const sonZaman      = new Date(b.SonSiloZamani).getTime();
      const mevcutKayit   = mikserIzlemeState.bosaltilanLotlar[b.MixerLotNo];
      // Baseline: startup'ta görülmüş silo sayısı; hiç görülmemişse -1 (yeni lot)
      const baselineSayisi = mikserIzlemeState.initSiloSayilari[b.MixerLotNo] ?? -1;
      const siloArtti      = b.SiloSayisi > baselineSayisi;

      if (!mevcutKayit && siloArtti) {
        // Baseline üstüne ilk kez çıktı → aktif boşaltma başladı
        mikserIzlemeState.bosaltilanLotlar[b.MixerLotNo] = {
          mixerLine:            b.MixerLine,
          urunTipi:             b.SemiProductType,
          siloSayisi:           b.SiloSayisi,
          sonSiloZamani:        Date.now(),
          bosaltmaBaslamaZamani: Date.now(),
          yuklemZamani:         mikserIzlemeState.yuklemZamanlari[b.MixerLotNo] || null,
        };
        const mesaj = [
          `🟡 *Mikser ${b.MixerLine} — ${urunKisaAd(b.SemiProductType)} Boşaltılmaya Başlandı*`,
          `🔢 Lot: \`${b.MixerLotNo}\``,
          '_Capssun Takip Sistemi_',
        ].join('\n');
        await mesajGonder(mesaj, ['admin', 'mikser']);
        console.log(`🟡 Boşaltma başladı: ${b.MixerLine} / ${b.MixerLotNo} (${b.SiloSayisi} silo)`);

      } else if (mevcutKayit) {
        if (b.SiloSayisi > mevcutKayit.siloSayisi) {
          // Yeni silo geldi → sayacı şimdiki zamana sıfırla
          mevcutKayit.siloSayisi    = b.SiloSayisi;
          mevcutKayit.sonSiloZamani = Date.now();
          console.log(`   Silo güncellendi: ${b.MixerLine} / ${b.MixerLotNo} → ${b.SiloSayisi} silo`);
        }
        // Silo sayısı değişmediyse timer olduğu yerde sayıyor, dokunma
      }
    }

    // ── 3. TAMAMLANMA KONTROLÜ (10 dk timeout) ───────────────
    //  Sadece startup sonrası çalışır; baseline lotlara uyarı gitmez.
    if (!ilkCalisma) {
      const simdi = Date.now();
      for (const [lotNo, kayit] of Object.entries(mikserIzlemeState.bosaltilanLotlar)) {
        if (mikserIzlemeState.tamamlananLotlar.has(lotNo)) continue;

        const bosaltmaSuresi = config.anlikIzleme?.mikserBosaltmaSuresi ?? 15;
        const gecenDakika    = (simdi - kayit.sonSiloZamani) / 60000;
        if (gecenDakika < bosaltmaSuresi) continue;

        // 10 dk yeni silo gelmedi → tamamlandı
        mikserIzlemeState.tamamlananLotlar.add(lotNo);
        delete mikserIzlemeState.bosaltilanLotlar[lotNo];

        const silolar  = await db.lotSilolariGetir(lotNo);
        const toplamKg = silolar.reduce((t, s) => t + (s.SiloWeight || 0), 0);

        const s = [];
        s.push(`✅ *Mikser ${kayit.mixerLine} boşaltıldı — ${urunKisaAd(kayit.urunTipi)}*`);
        s.push(`🔢 Seri No: \`${lotNo}\``);
        s.push('─────────────────────────');
        for (const silo of silolar) {
          s.push(`  🪣 Silo ${silo.SiloNo}: ${Number(silo.SiloWeight || 0).toFixed(1)} kg`);
        }
        s.push('─────────────────────────');
        s.push(`  📦 Toplam: *${toplamKg.toFixed(1)} kg* (${silolar.length} silo)`);
        if (kayit.yuklemZamani && kayit.bosaltmaBaslamaZamani) {
          const farkMs   = kayit.bosaltmaBaslamaZamani - kayit.yuklemZamani.getTime();
          const pad2l    = n => String(n).padStart(2, '0');
          const yuklemSa = `${pad2l(kayit.yuklemZamani.getHours())}:${pad2l(kayit.yuklemZamani.getMinutes())}`;
          const bosaltSa = `${pad2l(new Date(kayit.bosaltmaBaslamaZamani).getHours())}:${pad2l(new Date(kayit.bosaltmaBaslamaZamani).getMinutes())}`;
          s.push(`⏱️ Süre: *${sureFmt(farkMs / 60000)}* (${yuklemSa} → ${bosaltSa})`);
        }
        s.push('_Capssun Takip Sistemi_');

        await mesajGonder(s.join('\n'), ['admin', 'mikser']);
        console.log(`✅ Boşaltma tamamlandı: ${kayit.mixerLine} / ${lotNo} — ${silolar.length} silo, ${toplamKg.toFixed(1)} kg`);
      }
    }

  } catch (err) {
    console.error('❌ Mikser izleme hatası:', err.message);
  } finally {
    // Her durumda ilk çalışmayı tamamlanmış say
    mikserIzlemeState.ilkCalisma = false;
  }
}

// ── Arıza İzleme ─────────────────────────────────────────────
//
//  Startup'ta son arıza zamanını baseline olarak alır.
//  Her yoklamada ondan yeni arızaları sorgular, varsa admin'e bildirir.
//
const arizaIzlemeState = {
  ilkCalisma:    true,
  sonBilinenZaman: null,  // null = henüz init edilmedi
};

async function arizaIzlemeKontrol() {
  try {
    if (arizaIzlemeState.ilkCalisma) {
      const sonAriza = await db.sonArizaIdGetir();
      arizaIzlemeState.sonBilinenZaman = sonAriza
        ? new Date(sonAriza.OlusturmaTarihi)
        : new Date('2000-01-01');
      arizaIzlemeState.ilkCalisma = false;
      console.log(`🔧 Arıza izleme init: son arıza zamanı ${arizaIzlemeState.sonBilinenZaman.toISOString()}`);
      return;
    }

    const yeniArizalar = await db.yeniArizalariGetir(arizaIzlemeState.sonBilinenZaman);
    if (yeniArizalar.length === 0) return;

    for (const a of yeniArizalar) {
      const zaman = new Date(a.OlusturmaTarihi);
      if (zaman > arizaIzlemeState.sonBilinenZaman) {
        arizaIzlemeState.sonBilinenZaman = zaman;
      }

      const oncelikEmoji = a.Oncelik === 'Kritik' ? '🔴' : a.Oncelik === 'Yüksek' ? '🟠' : '🟡';
      const bildirimTarihi = new Date(a.BaslangicTarihi || a.OlusturmaTarihi).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });

      const mesaj = [
        `${oncelikEmoji} *YENİ ARIZA BİLDİRİMİ — ${a.ArizaId}*`,
        `   📍 Arıza Yeri     : ${a.ArizaYeri || '?'}`,
        `   🔧 Arıza Türü     : ${a.ArizaTuru || '?'}`,
        `   ⚡ Öncelik        : ${a.Oncelik || '?'}`,
        `   📅 Bildirim Tarihi: ${bildirimTarihi}`,
        a.Aciklamalar ? `   💬 Açıklama      : ${a.Aciklamalar}` : '',
        '─────────────────────────',
        '_Capssun Takip Sistemi_',
      ].filter(Boolean).join('\n');

      await mesajGonderAdmin(mesaj);
      console.log(`🔴 Yeni arıza bildirimi: ${a.ArizaId} — ${a.ArizaYeri}`);
    }
  } catch (err) {
    console.error('❌ Arıza izleme hatası:', err.message);
  }
}

// ── En son tamamlanan vardiyayı bul ──────────────────────────
function sonVardiyayiBul() {
  const simdi  = new Date();
  const saatTR = simdi.getHours();

  // 08:05 → Vardiya 1 (00-08) yeni bitti
  // 16:05 → Vardiya 2 (08-16) yeni bitti
  // 00:05 → Vardiya 3 (16-00) yeni bitti

  let vardiyaNo;
  let referansTarih = new Date(simdi);

  if (saatTR >= 8 && saatTR < 16) {
    // En son biten: Vardiya 1 (00:00-08:00)
    // Kayıtlar bugünün UretimTarihi ile yazılıyor, başlık da bugün.
    vardiyaNo = 1;
    return { vardiyaNo, referansTarih, displayOffset: 0 };
  } else if (saatTR >= 16) {
    // En son biten: Vardiya 2 (08:00-16:00), referans bugün
    vardiyaNo = 2;
  } else {
    // 00:00-07:59: En son biten Vardiya 3 (16:00-24:00), referans dün
    vardiyaNo = 3;
    referansTarih.setDate(referansTarih.getDate() - 1);
  }

  return { vardiyaNo, referansTarih, displayOffset: 0 };
}

// ── Günlük rapor üret ve gönder ─────────────────────────────
async function gunlukRaporGonder(tarih) {
  const d = new Date(tarih);
  const tarihEtiket = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
  console.log(`\n📅 Günlük rapor hazırlanıyor... (${tarihEtiket})`);

const [uretimKayitlari, beslemeKayitlari, aktifMikserler, bekleyenMikserler] =
    await Promise.all([
      db.gunlukUretimGetir(tarih),
      db.gunlukBeslemeTuketimGetir(tarih),
      db.aktifMikserlerGetir(),
      db.bekleyenMikserlerGetir(),
    ]);

  // Her vardiya için orta saatteki kaydın Vardiya harfini bul (4, 12, 20)
  // Vardiya 1 → saat 4, Vardiya 2 → saat 12, Vardiya 3 → saat 20
  function vardiyaHarfiBul(kayitlar, ortaSaat) {
    let enYakin = null, enKucuk = Infinity;
    for (const r of kayitlar) {
      const s = new Date(r.BitisSaati).getUTCHours();
      const fark = Math.abs(s - ortaSaat);
      if (fark < enKucuk) { enKucuk = fark; enYakin = r; }
    }
    return enYakin?.Vardiya || null;
  }

  const harf1 = vardiyaHarfiBul(uretimKayitlari, 4);
  const harf2 = vardiyaHarfiBul(uretimKayitlari, 12);
  const harf3 = vardiyaHarfiBul(uretimKayitlari, 20);
  console.log(`   Tespit: V1=${harf1}, V2=${harf2}, V3=${harf3}`);

  // Benzersiz harfleri çek ve hurda kayıtlarını birleştir
  const harfler = [...new Set([harf1, harf2, harf3].filter(Boolean))];
  const hurdaArrays = await Promise.all(harfler.map(h => db.hurdaVerileriniGetir(tarih, h)));
  const hurdaKayitlari = hurdaArrays.flat();

  console.log(`   Üretim kayıtları : ${uretimKayitlari.length}`);
  console.log(`   Hurda kayıtları  : ${hurdaKayitlari.length}`);

  // Dönem karşılaştırması: geçen hafta aynı gün
  const gecenHaftaTarih = new Date(tarih);
  gecenHaftaTarih.setDate(gecenHaftaTarih.getDate() - 7);
  const ohUretim  = await db.gunlukUretimGetir(gecenHaftaTarih);
  const ohHarfler = [...new Set([4, 12, 20].map(s => vardiyaHarfiBul(ohUretim, s)).filter(Boolean))];
  const ohHurdaArr = await Promise.all(ohHarfler.map(h => db.hurdaVerileriniGetir(gecenHaftaTarih, h)));
  const ohHurda   = ohHurdaArr.flat();

  const p2g = n => String(n).padStart(2, '0');
  const oncekiOzet  = hesaplaOzet(ohUretim, ohHurda);
  const simdikiOzet = hesaplaOzet(uretimKayitlari, hurdaKayitlari);
  const karsilastirma = {
    etiket : `Geçen Hafta (${p2g(gecenHaftaTarih.getDate())}.${p2g(gecenHaftaTarih.getMonth()+1)})`,
    onceki : oncekiOzet,
    simdiki: simdikiOzet,
  };

  const ortak = { tarih, uretimKayitlari, hurdaKayitlari, beslemeKayitlari, aktifMikserler, bekleyenMikserler };
  const mesajAdmin  = gunlukRaporuOlustur({ ...ortak, includeMikser: true,  karsilastirma });
  const mesajNormal = gunlukRaporuOlustur({ ...ortak, includeMikser: false });

  console.log('\n── GÜNLÜK MESAJ ÖNİZLEME (admin) ───────────\n');
  console.log(mesajAdmin);
  console.log('\n────────────────────────────────────────────\n');

  await mesajGonder(mesajAdmin,  ['admin']);
  await mesajGonder(mesajNormal, ['uretim']);
  console.log('✅ Günlük rapor gönderildi.\n');
}

// ── Rapor üret ve gönder ──────────────────────────────────────
// displayOffset: Genellikle 0. Gelecekte tarihin başlıkta farklı gösterilmesi gereken
// özel durumlar için çağıran tarafından verilebilir.
async function raporGonder(vardiyaNo, referansTarih, displayOffset = 0) {
  const vConf = config.vardiyalar.find(v => v.no === vardiyaNo);
  if (!vConf) throw new Error(`Vardiya ${vardiyaNo} config'de bulunamadı`);

  const displayTarih = new Date(referansTarih);
  if (displayOffset !== 0) displayTarih.setDate(displayTarih.getDate() + displayOffset);

  const baslangic = new Date(displayTarih);
  baslangic.setHours(vConf.baslangicSaat, 0, 0, 0);
  const bitis = new Date(displayTarih);
  bitis.setHours(vConf.bitisSaat === 24 ? 23 : vConf.bitisSaat, vConf.bitisSaat === 24 ? 59 : 0, 0, 0);

  console.log(`\n📊 Vardiya ${vardiyaNo} raporu hazırlanıyor...`);
  console.log(`   Sorgu tarihi  : ${referansTarih.toLocaleDateString('tr-TR')}`);
  console.log(`   Başlık tarihi : ${displayTarih.toLocaleDateString('tr-TR')}`);
  console.log(`   Saat aralığı  : ${vConf.baslangicSaat}:00 – ${vConf.bitisSaat}:00`);
  console.log(`   DB Vardiya    : Production tablosundan okunacak`);

  const uretimKayitlari = await db.uretimVerileriniGetir(referansTarih, vConf.baslangicSaat, vConf.bitisSaat);

  // Vardiya harfini üretim kayıtlarından türet (rotasyon sistemi, config'den alınamaz)
  const vardiyaHarfi = uretimKayitlari.length > 0
    ? uretimKayitlari[Math.floor(uretimKayitlari.length / 2)].Vardiya
    : null;
  console.log(`   Tespit edilen vardiya harfi: ${vardiyaHarfi}`);

  const [hurdaKayitlari, beslemeKayitlari, aktifMikserler, bekleyenMikserler] =
    await Promise.all([
      vardiyaHarfi ? db.hurdaVerileriniGetir(referansTarih, vardiyaHarfi) : Promise.resolve([]),
      db.beslemeTuketimGetir(referansTarih, vConf.baslangicSaat, vConf.bitisSaat),
      db.aktifMikserlerGetir(),
      db.bekleyenMikserlerGetir(),
    ]);

  console.log(`   Üretim kayıtları : ${uretimKayitlari.length}`);
  console.log(`   Hurda kayıtları  : ${hurdaKayitlari.length}`);
  console.log(`   Aktif mikserler  : ${aktifMikserler.length}`);
  console.log(`   Bekleyen stok    : ${bekleyenMikserler.length} tip`);

  // Dönem karşılaştırması: bir önceki gün aynı vardiya
  const oncekiTarih = new Date(referansTarih);
  oncekiTarih.setDate(oncekiTarih.getDate() - 1);
  const oncekiUretim = await db.uretimVerileriniGetir(oncekiTarih, vConf.baslangicSaat, vConf.bitisSaat);
  const oncekiVardiyaHarfi = oncekiUretim.length > 0
    ? oncekiUretim[Math.floor(oncekiUretim.length / 2)].Vardiya
    : null;
  const oncekiHurda = oncekiVardiyaHarfi
    ? await db.hurdaVerileriniGetir(oncekiTarih, oncekiVardiyaHarfi)
    : [];

  const oncekiOzet  = hesaplaOzet(oncekiUretim, oncekiHurda);
  const simdikiOzet = hesaplaOzet(uretimKayitlari, hurdaKayitlari);
  const p2 = n => String(n).padStart(2, '0');
  const karsilastirma = {
    etiket : `Dün V${vardiyaNo} (${p2(oncekiTarih.getDate())}.${p2(oncekiTarih.getMonth()+1)})`,
    onceki : oncekiOzet,
    simdiki: simdikiOzet,
  };

  // Stok tükenme tahmini (mevcut vardiya üretim hızına göre)
  const saatlikTuketim = simdikiOzet.toplamUretimKg / 8;
  const stokMapT = {};
  for (const m of bekleyenMikserler) {
    stokMapT[m.SemiProductType] = (stokMapT[m.SemiProductType] || 0) + (m.ToplamKg || 0);
  }
  const stokTahmini = Object.entries(config.uyariEsikleri.hazirStokLimitleri || {}).map(([urunTipi, limit]) => {
    const mevcutKg  = stokMapT[urunTipi] || 0;
    const kalanSaat = saatlikTuketim > 0 ? mevcutKg / saatlikTuketim : null;
    return { urunTipi, mevcutKg, kalanSaat, durum: mevcutKg < limit ? '⚠️' : '✅' };
  });

  // Anlık üretim durumu (son 5 kayıt, hata filtreli)
  const anlikHam    = await db.anlikUretimDurumuGetir();
  const anlikUretim = anlikUretimOzetle(anlikHam);

  const ortak = { vardiyaNo, baslangic, bitis, uretimKayitlari, hurdaKayitlari, beslemeKayitlari, aktifMikserler, bekleyenMikserler };
  const mesajAdmin  = vardiyaRaporuOlustur({ ...ortak, includeMikser: true,  karsilastirma, stokTahmini, anlikUretim });
  const mesajNormal = vardiyaRaporuOlustur({ ...ortak, includeMikser: false, anlikUretim });

  console.log('\n── MESAJ ÖNİZLEME (admin) ──────────────────\n');
  console.log(mesajAdmin);
  console.log('\n────────────────────────────────────────────\n');

  await mesajGonder(mesajAdmin,  ['admin']);
  await mesajGonder(mesajNormal, ['uretim']);

  await uyariKontrol({ vardiyaNo, uretimKayitlari, hurdaKayitlari, bekleyenMikserler, baslangic, bitis });

  console.log('✅ Rapor gönderildi.\n');
}

// ── Uyarı kontrolü (vardiya sonrası admin'e gönderilir) ───────
async function uyariKontrol({ vardiyaNo, uretimKayitlari, hurdaKayitlari, bekleyenMikserler, baslangic, bitis }) {
  const esik = config.uyariEsikleri;
  const uyarilar = [];

  // 1. Üretim yok / duruş şüphesi
  if (uretimKayitlari.length < esik.vardiyaMinUrun) {
    uyarilar.push(`🔴 *Üretim Durması:* Vardiya ${vardiyaNo}'de yalnızca ${uretimKayitlari.length} üretim kaydı tespit edildi.`);
  }

  // 2. Eksik ürün sayısı
  const eksikler = uretimKayitlari.filter(r => r.EksikMetraj === true || r.EksikMetraj === 1);
  if (eksikler.length >= esik.eksikUrunEsigi) {
    const hatEksik = {};
    for (const r of eksikler) {
      const hat = config.hatlar[r.UretimHatti] || r.UretimHatti;
      hatEksik[hat] = (hatEksik[hat] || 0) + 1;
    }
    const detay = Object.entries(hatEksik).map(([h, n]) => `${h}: ${n} adet`).join(', ');
    uyarilar.push(`🟠 *Eksik Ürün:* Toplam ${eksikler.length} adet (eşik: ${esik.eksikUrunEsigi}) — ${detay}`);
  }

  // 3. Fire oranı (genel toplam)
  let totalUretimKg = 0, totalHurda = 0, totalRecycle = 0;
  for (const r of uretimKayitlari) {
    const gram = r.Gram || 0, genislik = r.Genislik || 0;
    totalUretimKg += (gram / 1000) * (genislik / 1000) * (r.MetreKg || 0);
    totalRecycle  += (gram / 1000) * (genislik / 1000);  // 1m lab numunesi
  }
  for (const r of hurdaKayitlari) {
    totalHurda   += (r.EriyikHurda || 0) + (r.HaliHurda || 0) + (r.RuloHurda || 0);
    totalRecycle += (r.HaliRecycle || 0) + (r.RuloRecycle || 0) + (r.Sarim || 0);
  }
  const topFire  = totalHurda + totalRecycle;
  const topGirdi = totalUretimKg + topFire;
  const fireOrani = topGirdi > 0 ? (topFire / topGirdi) * 100 : 0;
  if (topGirdi > 0 && fireOrani >= esik.fireOraniEsigi) {
    uyarilar.push(`🟡 *Yüksek Fire Oranı:* %${fireOrani.toFixed(2)} (eşik: %${esik.fireOraniEsigi})`);
  }

  // 4. Ürün tipine göre hazır stok kontrolü
  const stokMap = {};
  for (const m of bekleyenMikserler) {
    stokMap[m.SemiProductType] = (stokMap[m.SemiProductType] || 0) + (m.ToplamKg || 0);
  }
  for (const [urunTipi, limit] of Object.entries(esik.hazirStokLimitleri || {})) {
    const mevcutKg = stokMap[urunTipi] || 0;
    if (mevcutKg < limit) {
      uyarilar.push(`🟣 *Düşük Stok (${urunTipi}):* ${mevcutKg.toFixed(0)} kg kaldı (limit: ${limit.toLocaleString('tr-TR')} kg)`);
    }
  }

  if (uyarilar.length === 0) return;

  const pad2 = n => String(n).padStart(2, '0');
  const saatFmt = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const tarihFmt = d => `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()}`;

  const mesaj = [
    `⚠️ *UYARI – Vardiya ${vardiyaNo}*`,
    `📅 ${tarihFmt(baslangic)}  |  ${saatFmt(baslangic)} – ${saatFmt(bitis)}`,
    '─────────────────────────',
    ...uyarilar,
    '─────────────────────────',
    '_Capssun Takip Sistemi_',
  ].join('\n');

  console.log(`⚠️ ${uyarilar.length} uyarı tespit edildi, admin'e gönderiliyor.`);
  await mesajGonderAdmin(mesaj);
}

// ── Haftalık rapor üret ve gönder ────────────────────────────
async function haftalikRaporGonder() {
  // Pazartesi 08:10'da çalışır → önceki haftanın Pzt-Paz dönemini kapsar
  const simdi    = new Date();
  const bitis    = new Date(simdi);
  bitis.setDate(bitis.getDate() - 1);   // dün (Pazar)
  bitis.setHours(23, 59, 59, 999);
  const baslangic = new Date(bitis);
  baslangic.setDate(baslangic.getDate() - 6);  // 6 gün önce (Pazartesi)
  baslangic.setHours(0, 0, 0, 0);

  const pad2 = n => String(n).padStart(2, '0');
  const fmt  = d => `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()}`;
  console.log(`\n📊 Haftalık rapor hazırlanıyor... (${fmt(baslangic)} – ${fmt(bitis)})`);

  const bitisSorgu = new Date(bitis.getTime() + 1);  // exclusive upper bound

  const [uretimKayitlari, hurdaKayitlari] = await Promise.all([
    db.haftalikUretimGetir(baslangic, bitisSorgu),
    db.haftalikHurdaGetir(baslangic, bitisSorgu),
  ]);

  console.log(`   Üretim kayıtları : ${uretimKayitlari.length}`);
  console.log(`   Hurda kayıtları  : ${hurdaKayitlari.length}`);

  const hafOrtak = { baslangicTarih: baslangic, bitisTarih: bitis, uretimKayitlari, hurdaKayitlari };
  const mesajAdmin  = haftalikRaporuOlustur({ ...hafOrtak, adminRaporu: true  });
  const mesajNormal = haftalikRaporuOlustur({ ...hafOrtak, adminRaporu: false });

  console.log('\n── HAFTALIK MESAJ ÖNİZLEME (admin) ─────────\n');
  console.log(mesajAdmin);
  console.log('\n────────────────────────────────────────────\n');

  await mesajGonder(mesajAdmin,  ['admin']);
  await mesajGonder(mesajNormal, ['uretim']);
  console.log('✅ Haftalık rapor gönderildi.\n');
}

// ── Aylık rapor üret ve gönder ────────────────────────────────
async function aylikOtomatikRaporGonder() {
  const simdi = new Date();
  // Her ayın 1'inde çalışır → önceki ayı raporla
  const yil = simdi.getMonth() === 0 ? simdi.getFullYear() - 1 : simdi.getFullYear();
  const ay  = simdi.getMonth() === 0 ? 12 : simdi.getMonth(); // önceki ay (1-indexed)

  const AYLAR_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  console.log(`\n📊 Aylık rapor hazırlanıyor... (${AYLAR_TR[ay - 1]} ${yil})`);

  const baslangic = new Date(yil, ay - 1, 1, 0, 0, 0, 0);
  const bitis     = new Date(yil, ay,     1, 0, 0, 0, 0); // exclusive

  const [uretimKayitlari, hurdaKayitlari] = await Promise.all([
    db.haftalikUretimGetir(baslangic, bitis),
    db.haftalikHurdaGetir(baslangic, bitis),
  ]);

  console.log(`   Üretim kayıtları : ${uretimKayitlari.length}`);
  console.log(`   Hurda kayıtları  : ${hurdaKayitlari.length}`);

  const mesajAdmin  = aylikRaporuOlustur({ yil, ay, uretimKayitlari, hurdaKayitlari, adminRaporu: true  });
  const mesajNormal = aylikRaporuOlustur({ yil, ay, uretimKayitlari, hurdaKayitlari, adminRaporu: false });

  console.log('\n── AYLIK MESAJ ÖNİZLEME (admin) ─────────────\n');
  console.log(mesajAdmin);
  console.log('\n──────────────────────────────────────────────\n');

  await mesajGonder(mesajAdmin,  ['admin']);
  await mesajGonder(mesajNormal, ['uretim']);
  console.log('✅ Aylık rapor gönderildi.\n');
}

// ── WhatsApp hazır ────────────────────────────────────────────
client.on('ready', async () => {
  console.log('✅ WhatsApp bağlandı!\n');

  try {
    if (MOD === '--son-vardiya') {
      const { vardiyaNo, referansTarih, displayOffset } = sonVardiyayiBul();
      console.log(`🕐 En son tamamlanan: Vardiya ${vardiyaNo}`);
      await raporGonder(vardiyaNo, referansTarih, displayOffset);
      await client.destroy();
      process.exit(0);

    } else if (MOD === '--vardiya-1') {
      await raporGonder(1, TARIH_ARG || new Date());
      await client.destroy();
      process.exit(0);

    } else if (MOD === '--vardiya-2') {
      await raporGonder(2, TARIH_ARG || new Date());
      await client.destroy();
      process.exit(0);

    } else if (MOD === '--vardiya-3') {
      await raporGonder(3, TARIH_ARG || new Date());
      await client.destroy();
      process.exit(0);

    } else if (MOD === '--gunluk') {
      // node index.js --gunluk            → dünün günlük raporu
      // node index.js --gunluk 2026-05-07 → o günün raporu
      const hedefTarih = TARIH_ARG || (() => {
        const d = new Date(); d.setDate(d.getDate() - 1); return d;
      })();
      await gunlukRaporGonder(hedefTarih);
      await client.destroy();
      process.exit(0);

    } else {
      // ── Zamanlanmış mod ──────────────────────────────────
      const dk = config.raporGecikimeDakika;

      // Vardiya 1 sonu → 08:05
      cron.schedule(`${dk} 8 * * *`, async () => {
        try { await raporGonder(1, new Date()); }
        catch(e) {
          console.error('❌ Vardiya 1:', e.message);
          await mesajGonderAdmin(`❌ *Vardiya 1 rapor hatası:*\n${e.message}`).catch(() => {});
        }
      }, { timezone: 'Europe/Istanbul' });

      // Vardiya 2 sonu → 16:05
      cron.schedule(`${dk} 16 * * *`, async () => {
        try { await raporGonder(2, new Date()); }
        catch(e) {
          console.error('❌ Vardiya 2:', e.message);
          await mesajGonderAdmin(`❌ *Vardiya 2 rapor hatası:*\n${e.message}`).catch(() => {});
        }
      }, { timezone: 'Europe/Istanbul' });

      // Vardiya 3 sonu → 00:05 + günlük rapor
      cron.schedule(`${dk} 0 * * *`, async () => {
        const dun = new Date();
        dun.setDate(dun.getDate() - 1);
        try { await raporGonder(3, dun); }
        catch(e) {
          console.error('❌ Vardiya 3:', e.message);
          await mesajGonderAdmin(`❌ *Vardiya 3 rapor hatası:*\n${e.message}`).catch(() => {});
        }
        try { await gunlukRaporGonder(dun); }
        catch(e) {
          console.error('❌ Günlük rapor:', e.message);
          await mesajGonderAdmin(`❌ *Günlük rapor hatası:*\n${e.message}`).catch(() => {});
        }
      }, { timezone: 'Europe/Istanbul' });

      // Haftalık rapor → Her Pazartesi 08:10 (Vardiya 1 raporundan sonra)
      cron.schedule(`10 8 * * 1`, async () => {
        try { await haftalikRaporGonder(); }
        catch(e) {
          console.error('❌ Haftalık rapor:', e.message);
          await mesajGonderAdmin(`❌ *Haftalık rapor hatası:*\n${e.message}`).catch(() => {});
        }
      }, { timezone: 'Europe/Istanbul' });

      // Aylık rapor → Her ayın 1'i 08:10 (önceki ay özeti)
      cron.schedule(`10 8 1 * *`, async () => {
        try { await aylikOtomatikRaporGonder(); }
        catch(e) {
          console.error('❌ Aylık rapor:', e.message);
          await mesajGonderAdmin(`❌ *Aylık rapor hatası:*\n${e.message}`).catch(() => {});
        }
      }, { timezone: 'Europe/Istanbul' });

      // Anlık izleme + Mikser izleme → her N dakikada bir
      if (config.anlikIzleme?.aktif) {
        const aralik = config.anlikIzleme.yoklamaAraligi || 5;
        // İlk çalışmada init et (uyarı spam önleme)
        await anlikIzlemeKontrol();
        await mikserIzlemeKontrol();
        await arizaIzlemeKontrol();
        cron.schedule(`*/${aralik} * * * *`, async () => {
          await anlikIzlemeKontrol();
          await mikserIzlemeKontrol();
          await arizaIzlemeKontrol();
        }, { timezone: 'Europe/Istanbul' });
        console.log(`🔍 Anlık izleme aktif (her ${aralik} dk) — duruş: ${config.anlikIzleme.uretimDurmaEsigi} dk, ek ürün: ${config.anlikIzleme.ekUrunEsigi}/${config.anlikIzleme.sonKacUrunBaksin}`);
        console.log(`🔵 Mikser izleme aktif — yüklendi/boşaltıldı bildirimleri açık`);
        console.log(`🔴 Arıza izleme aktif — yeni arızalar anlık admin'e bildirilecek`);
      }

      console.log(`⏰ Zamanlanmış mod aktif (gecikme: ${dk} dk)`);
      console.log('   08:05 → Vardiya 1 | 16:05 → Vardiya 2 | 00:05 → Vardiya 3 + Günlük');
      console.log('   Her Pazartesi 08:10 → Haftalık Rapor');
      console.log('   Her ayın 1\'i 08:10 → Aylık Rapor');
      console.log('\n🟢 Çalışıyor. Durdurmak için Ctrl+C.\n');
    }
  } catch (err) {
    console.error('❌ Hata:', err.message);
    await client.destroy();
    process.exit(1);
  }
});

// ── Gelen mesajları dinle ─────────────────────────────────────
client.on('message', async (msg) => {
  if (!msg.body || !msg.body.trim()) return;

  // Grup mesajıysa: grubun komut iznini kontrol et
  if (msg.from.endsWith('@g.us')) {
    const grup = config.alicilar.find(a => a.gid === msg.from);
    if (!grup?.komut) return;
  }

  const gonderenId  = msg.from.endsWith('@g.us') ? msg.author : msg.from;
  const hedefAdres  = msg.from;
  const metin       = msg.body.trim();

  // ── Kayıt oturumu aktifse // olmadan da yanıt ver ────────────
  if (kayitOturumlari[gonderenId]) {
    await kayitOturumuIsle(gonderenId, hedefAdres, metin);
    return;
  }

  // Yalnızca // ile başlayan komutlara tepki ver
  if (!metin.startsWith('//')) return;

  console.log(`📩 Mesaj: from=${msg.from} | author=${msg.author ?? '-'} | body=${metin}`);

  const komutGovde = metin.slice(2).trim();
  const girisTrim  = komutGovde.toLowerCase();

  // ── //kayit — herkese açık ────────────────────────────────────
  if (girisTrim === 'kayit') {
    if (msg.from.endsWith('@g.us')) {
      await client.sendMessage(hedefAdres, '⛔ Kayıt yalnızca bireysel sohbette yapılabilir.');
      return;
    }
    kayitOturumlari[gonderenId] = { asama: 'isim' };
    await client.sendMessage(hedefAdres,
      '👋 *Kayıt Formu*\n\nAdınızı ve soyadınızı yazın:'
    );
    return;
  }

  // Yetkili kullanıcı kontrolü (bundan sonrası için)
  const yetkiliMi = config.alicilar.some(a => {
    if (a.gid) return false;
    const temiz = (a.tel || '').replace(/[^0-9]/g, '');
    return gonderenId === temiz + '@c.us' || gonderenId === a.lid;
  });

  if (!yetkiliMi) {
    console.log(`⛔ Yetkisiz gönderen (yoksayıldı): ${gonderenId}`);
    return;
  }

  // Admin: onay bekleme durumundaysa 1/2 yanıtını işle
  const adminBekle = onayBekleyen[gonderenId];
  if (adminBekle && (girisTrim === '1' || girisTrim === '2')) {
    delete onayBekleyen[gonderenId];
    const aktif  = girisTrim === '1';
    const kayit  = ku.onayla(adminBekle.kayitId, aktif);
    if (!kayit) {
      await client.sendMessage(hedefAdres, '⚠️ Kayıt bulunamadı.');
      return;
    }
    await client.sendMessage(hedefAdres,
      `✅ *${kayit.isim}* ${aktif ? 'aktif' : 'pasif'} olarak kaydedildi.`
    );
    // Kullanıcıya bildir
    try {
      await client.sendMessage(kayit.chatId,
        aktif
          ? `✅ *Kaydınız onaylandı!*\nArtık sisteme dahilsiniz ve otomatik raporları alacaksınız.\n_Capssun Takip Sistemi_`
          : `✅ *Kaydınız onaylandı.*\nSisteme kayıtlısınız ancak otomatik rapor almayacaksınız.\n_Capssun Takip Sistemi_`
      );
    } catch { /* kullanıcıya ulaşılamazsa sessizce geç */ }
    return;
  }

  console.log(`📨 Yetkili komut alındı (${gonderenId} → ${hedefAdres}): //${komutGovde}`);

  try {

    // ── //onayla ID — admin kullanıcıyı onaylar ──────────────────
    if (girisTrim.startsWith('onayla')) {
      const alici = config.alicilar.find(a => {
        if (a.gid) return false;
        const temiz = (a.tel || '').replace(/[^0-9]/g, '');
        return gonderenId === temiz + '@c.us' || gonderenId === a.lid;
      });
      if (alici?.rol !== 'admin') {
        await client.sendMessage(hedefAdres, '⛔ Bu komut yalnızca admin kullanabilir.');
        return;
      }
      // Önceki onay tamamlanmadan yenisine geçme
      if (onayBekleyen[gonderenId]) {
        const onceki = onayBekleyen[gonderenId].kayitId;
        await client.sendMessage(hedefAdres,
          `⚠️ Önce *#${onceki}* için seçim yapın:\n1️⃣ Aktif  2️⃣ Pasif`
        );
        return;
      }
      const id = parseInt(komutGovde.split(/\s+/)[1]);
      if (!id) { await client.sendMessage(hedefAdres, '⚠️ Kullanım: //onayla <ID>'); return; }
      const bekleyen = ku.bekleyenGetir(id);
      if (!bekleyen) { await client.sendMessage(hedefAdres, `⚠️ #${id} numaralı bekleyen kayıt bulunamadı.`); return; }
      onayBekleyen[gonderenId] = { kayitId: id };
      await client.sendMessage(hedefAdres,
        `✅ *${bekleyen.isim}* onaylanacak.\n\nOtomatik rapor alsın mı?\n1️⃣ Evet (aktif)\n2️⃣ Hayır (pasif)`
      );
      return;
    }

    // ── //reddet ID — admin kullanıcıyı reddeder ─────────────────
    if (girisTrim.startsWith('reddet')) {
      const alici = config.alicilar.find(a => {
        if (a.gid) return false;
        const temiz = (a.tel || '').replace(/[^0-9]/g, '');
        return gonderenId === temiz + '@c.us' || gonderenId === a.lid;
      });
      if (alici?.rol !== 'admin') {
        await client.sendMessage(hedefAdres, '⛔ Bu komut yalnızca admin kullanabilir.');
        return;
      }
      const id = parseInt(komutGovde.split(/\s+/)[1]);
      if (!id) { await client.sendMessage(hedefAdres, '⚠️ Kullanım: //reddet <ID>'); return; }
      const kayit = ku.reddet(id);
      if (!kayit) { await client.sendMessage(hedefAdres, `⚠️ #${id} numaralı bekleyen kayıt bulunamadı.`); return; }
      await client.sendMessage(hedefAdres, `❌ *${kayit.isim}* reddedildi.`);
      try {
        await client.sendMessage(kayit.chatId,
          '❌ Kayıt talebiniz reddedildi.\n_Capssun Takip Sistemi_'
        );
      } catch { /* sessizce geç */ }
      return;
    }

    // ── //kayitlar — admin bekleyen kayıtları listeler ───────────
    if (girisTrim === 'kayitlar') {
      const alici = config.alicilar.find(a => {
        if (a.gid) return false;
        const temiz = (a.tel || '').replace(/[^0-9]/g, '');
        return gonderenId === temiz + '@c.us' || gonderenId === a.lid;
      });
      if (alici?.rol !== 'admin') {
        await client.sendMessage(hedefAdres, '⛔ Bu komut yalnızca admin kullanabilir.');
        return;
      }
      const tumü = ku.tumKayitlar();
      const bekleyenler = tumü.filter(k => k.durum === 'bekliyor');
      if (!bekleyenler.length) {
        await client.sendMessage(hedefAdres, '✅ Bekleyen kayıt talebi yok.');
        return;
      }
      const s = ['🔔 *Bekleyen Kayıt Talepleri*', '─────────────────────────'];
      for (const k of bekleyenler) {
        const tarih = new Date(k.olusturmaTarihi).toLocaleString('tr-TR');
        s.push(`*#${k.id}* — ${k.isim}\n   💼 ${k.pozisyon} | 🏭 ${k.birim}\n   📅 ${tarih}`);
      }
      s.push('─────────────────────────');
      s.push('Onay: //onayla <ID> | Red: //reddet <ID>');
      await client.sendMessage(hedefAdres, s.join('\n'));
      return;
    }

    // ── //alicilar — tüm aktif alıcıları listeler (config + kayıtlı) ─
    if (girisTrim === 'alicilar') {
      const alici = config.alicilar.find(a => {
        if (a.gid) return false;
        const temiz = (a.tel || '').replace(/[^0-9]/g, '');
        return gonderenId === temiz + '@c.us' || gonderenId === a.lid;
      });
      if (alici?.rol !== 'admin') {
        await client.sendMessage(hedefAdres, '⛔ Bu komut yalnızca admin kullanabilir.');
        return;
      }
      const s = ['👥 *Aktif Alıcılar*', '─────────────────────────'];

      // Config'deki bireysel kişiler
      const configKisiler = config.alicilar.filter(a => !a.gid && a.aktif !== false);
      if (configKisiler.length) {
        s.push('*📋 Sabit Kullanıcılar:*');
        for (const a of configKisiler) {
          s.push(`  • ${a.isim} — ${a.rol}`);
        }
      }

      // Config'deki aktif gruplar
      const configGruplar = config.alicilar.filter(a => a.gid && a.aktif !== false);
      if (configGruplar.length) {
        s.push('*👥 Aktif Gruplar:*');
        for (const a of configGruplar) {
          s.push(`  • ${a.isim} — ${a.rol}`);
        }
      }

      // Kayıtlı onaylı kullanıcılar
      const kayitlilar = ku.tumKayitlar().filter(k => k.durum === 'onaylandi');
      if (kayitlilar.length) {
        s.push('*✅ Kayıtlı Kullanıcılar:*');
        for (const k of kayitlilar) {
          const durum = k.aktif ? 'aktif' : 'pasif';
          s.push(`  • #${k.id} ${k.isim} — ${k.birim} (${durum})`);
        }
      }

      // Bekleyen kayıtlar
      const bekleyenler = ku.tumKayitlar().filter(k => k.durum === 'bekliyor');
      if (bekleyenler.length) {
        s.push(`*🔔 Bekleyen Onay: ${bekleyenler.length} talep*`);
        s.push('  → Görmek için: //kayitlar');
      }

      s.push('─────────────────────────');
      await client.sendMessage(hedefAdres, s.join('\n'));
      return;
    }

    // ── //sunum — açılış mesajı sunum katılımcılarına gider ─────
    if (girisTrim === 'sunum') {
      const alici = config.alicilar.find(a => {
        if (a.gid) return false;
        const temiz = (a.tel || '').replace(/[^0-9]/g, '');
        return gonderenId === temiz + '@c.us' || gonderenId === a.lid;
      });
      if (alici?.rol !== 'admin') {
        await client.sendMessage(hedefAdres, '⛔ Bu komut yalnızca admin kullanabilir.');
        return;
      }
      let sunumAlicilari;
      try {
        sunumAlicilari = JSON.parse(require('fs').readFileSync(
          require('path').join(__dirname, 'sunum-alicilar.json'), 'utf8'
        )).alicilar.filter(a => a.tel && a.tel !== '905321234567');
      } catch {
        await client.sendMessage(hedefAdres, '❌ sunum-alicilar.json okunamadı.');
        return;
      }
      if (sunumAlicilari.length === 0) {
        await client.sendMessage(hedefAdres, '⚠️ sunum-alicilar.json içinde geçerli numara yok.\nÖrnek numarayı gerçek numaralarla değiştir.');
        return;
      }
      const acilis = [
        '🏭 *CPS Üretim Takip Sistemi*',
        '─────────────────────────',
        '',
        'Şu anda elinizde tuttuğunuz telefon,',
        'fabrikanın nabzını gerçek zamanlı izleyen',
        'sistemin bir parçası.',
        '',
        '📊 Vardiya raporları',
        '🧪 Mikser & kalite takibi',
        '📡 IoT sensör ağı',
        '🤖 Yapay zeka destekli sorgulama',
        '',
        '_Üretim yönetiminin bir daha eskisi gibi_',
        '_olmayacağı sunuma hoş geldiniz._',
        '',
        '─────────────────────────',
        '_Capssun · CPS Takip Sistemi · 2026_',
      ].join('\n');

      let basarili = 0;
      for (const kisi of sunumAlicilari) {
        try {
          const hedef = kisi.tel.replace(/[^0-9]/g, '') + '@c.us';
          await client.sendMessage(hedef, acilis);
          basarili++;
          await bekle(1500);
        } catch (err) {
          console.error(`✕ Sunum açılış → ${kisi.isim}: ${err.message}`);
        }
      }
      await client.sendMessage(hedefAdres,
        `✅ Açılış mesajı *${basarili}/${sunumAlicilari.length}* kişiye gönderildi.\n🎤 Sunuma başlayabilirsin!`
      );
      return;
    }

    // ── //sunumson — kapanış mesajı sunum katılımcılarına gider ─
    if (girisTrim === 'sunumson') {
      const alici = config.alicilar.find(a => {
        if (a.gid) return false;
        const temiz = (a.tel || '').replace(/[^0-9]/g, '');
        return gonderenId === temiz + '@c.us' || gonderenId === a.lid;
      });
      if (alici?.rol !== 'admin') {
        await client.sendMessage(hedefAdres, '⛔ Bu komut yalnızca admin kullanabilir.');
        return;
      }
      let sunumAlicilari;
      try {
        sunumAlicilari = JSON.parse(require('fs').readFileSync(
          require('path').join(__dirname, 'sunum-alicilar.json'), 'utf8'
        )).alicilar.filter(a => a.tel && a.tel !== '905321234567');
      } catch {
        await client.sendMessage(hedefAdres, '❌ sunum-alicilar.json okunamadı.');
        return;
      }
      if (sunumAlicilari.length === 0) {
        await client.sendMessage(hedefAdres, '⚠️ sunum-alicilar.json içinde geçerli numara yok.');
        return;
      }
      const kapanis = [
        '✅ *Sunum Tamamlandı*',
        '─────────────────────────',
        '',
        'Bugün paylaştığımız vizyon:',
        '',
        '📊 Gerçek zamanlı üretim & vardiya takibi',
        '🔬 Kalite sistemi entegrasyonu',
        '🌡️ ESP32 IoT çevre & sensör ağı',
        '⚡ Tahminsel bakım (akım · titreşim · akış)',
        '🤖 Yapay zeka destekli doğal dil sorgulama',
        '',
        'Sorularınız ve ilginiz için teşekkürler.',
        'Bu sistem sizin için çalışmaya devam ediyor.',
        '',
        '─────────────────────────',
        '_Capssun · CPS Üretim Takip Sistemi · 2026_',
      ].join('\n');

      let basarili = 0;
      for (const kisi of sunumAlicilari) {
        try {
          const hedef = kisi.tel.replace(/[^0-9]/g, '') + '@c.us';
          await client.sendMessage(hedef, kapanis);
          basarili++;
          await bekle(1500);
        } catch (err) {
          console.error(`✕ Sunum kapanış → ${kisi.isim}: ${err.message}`);
        }
      }
      await client.sendMessage(hedefAdres,
        `✅ Kapanış mesajı *${basarili}/${sunumAlicilari.length}* kişiye gönderildi.`
      );
      return;
    }

    // ── miksertest komutu — örnek mikser yüklendi mesajı (geçici) ─
    if (girisTrim === 'miksertest') {
      const ornekMesaj = [
        '🔵 *Mikser A — POE yüklendi*',
        '🔢 Lot: `PO01A0113052026MC`',
        '_Capssun Takip Sistemi_',
      ].join('\n');
      await mesajGonderAdmin(ornekMesaj);
      return;
    }

    // ── test komutu (yalnızca admin) — aktif alıcılara test mesajı ─
    if (girisTrim === 'test') {
      const alici = config.alicilar.find(a => {
        if (a.gid) return false;
        const temiz = (a.tel || '').replace(/[^0-9]/g, '');
        return gonderenId === temiz + '@c.us' || gonderenId === a.lid;
      });
      if (alici?.rol !== 'admin') {
        await client.sendMessage(hedefAdres, '⛔ Bu komut yalnızca admin kullanabilir.');
        return;
      }
      const testMesaj = [
        '🟢 *Test mesajı*',
        '_Capssun Takip Sistemi_',
        `_Gönderim zamanı: ${new Date().toLocaleTimeString('tr-TR')}_`,
      ].join('\n');
      await mesajGonder(testMesaj, ['admin']);
      await mesajGonder(testMesaj, ['uretim']);
      await client.sendMessage(hedefAdres, '✅ Test mesajı tüm aktif alıcılara gönderildi.');
      return;
    }

    // ── gruplar komutu (yalnızca admin) ──────────────────────
    if (girisTrim === 'gruplar') {
      const alici = config.alicilar.find(a => {
        if (a.gid) return false;
        const temiz = (a.tel || '').replace(/[^0-9]/g, '');
        return gonderenId === temiz + '@c.us' || gonderenId === a.lid;
      });
      if (alici?.rol !== 'admin') {
        await client.sendMessage(hedefAdres, '⛔ Bu komut yalnızca admin kullanabilir.');
        return;
      }
      try {
        const chats  = await client.getChats();
        const gruplar = chats.filter(c => c.isGroup);
        if (gruplar.length === 0) {
          await client.sendMessage(hedefAdres, '⚠️ Bot henüz hiçbir gruba üye değil.');
          return;
        }
        const satirlar = ['📋 *BOT\'UN ÜYE OLDUĞU GRUPLAR*', '─────────────────────────'];
        for (const g of gruplar) {
          satirlar.push(`*${g.name}*`);
          satirlar.push(`  ID: \`${g.id._serialized}\``);
          satirlar.push(`  Üye: ${g.participants?.length ?? '?'}`);
        }
        satirlar.push('─────────────────────────');
        satirlar.push('_Config\'e eklemek için:_');
        satirlar.push('`{ isim: \'Ad\', gid: \'ID\', rol: \'uretim\' }`');
        await client.sendMessage(hedefAdres, satirlar.join('\n'));
      } catch (e) {
        await client.sendMessage(hedefAdres, `❌ Gruplar alınamadı: ${e.message}`);
      }
      return;
    }

    // Menü komutu değilse (serbest metin = LLM sorusu) önce bekleme mesajı gönder
    const menuKomutlari = ['rapor', 'menu', 'menü', 'sıfırla', 'sifirla', 'temizle', 'test', 'gruplar', '0','1','2','3','4','5'];
    const llmSorusu = !menuKomutlari.includes(girisTrim);

    if (llmSorusu) {
      await client.sendMessage(hedefAdres, '⏳ _Yanıt hazırlanıyor..._');
    }

    const yanit = await mesajiIsle(hedefAdres, komutGovde);
    if (yanit) {
      await client.sendMessage(hedefAdres, yanit);
    }
  } catch (err) {
    console.error('❌ Mesaj işleme hatası:', err.message);
    console.error(err.stack);
    try {
      await client.sendMessage(hedefAdres, '❌ Bir hata oluştu, lütfen tekrar dene.');
    } catch (_) {}
  }
});

client.initialize();

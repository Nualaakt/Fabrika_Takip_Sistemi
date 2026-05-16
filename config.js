module.exports = {

  db: {
    server:   '192.168.1.131',
    port:      1433,
    database: 'ProductionDB',
    user:     'sa',
    password: 'capssunsrv2022*',
    connectionTimeout:  3000,
    requestTimeout:     5000,
    options: {
      encrypt:                false,
      trustServerCertificate: true,
    },
  },

  // ── Birim / Rol sistemi ────────────────────────────────────────
  //
  //  rol: 'admin'  → Tüm raporlar (admin detaylı versiyon) + uyarılar
  //  rol: 'uretim' → Üretim raporları (vardiya, günlük, haftalık, aylık)
  //  rol: 'kalite' → Kalite raporları (Q_Gorunus, Q_UMDR özeti) — yakında
  //  rol: 'bakim'  → Arıza bildirimleri (Bkm-Ariza) — yakında
  //  rol: 'depo'   → Sevkiyat & stok raporları (DispatchTable) — yakında
  //
  //  ÖNEMLİ: Her birim raporu iki kez gönderilir:
  //    1) mesajGonder(adminVersiyonu, ['admin'])   → yalnızca adminler
  //    2) mesajGonder(normalVersiyon, ['birimAdi']) → yalnızca o birim
  //
  alicilar: [
    // ── Bireysel kişiler ──────────────────────────────────────
    { isim: 'Kaan Talu',       tel: '905393190000', lid: '200235821346818@lid', rol: 'admin',  aktif: true  },
    { isim: 'İsmail Uslu',    tel: '905357390808', lid: '176510422016096@lid', rol: 'uretim', aktif: true  },
    //{ isim: 'Sevgi Servi',    tel: '905067341000', lid: '260773402132506@lid', rol: 'kalite', aktif: false },
    //{ isim: 'Cemre Alemdar',  tel: '905333410156', lid: '218699885748357@lid', rol: 'kalite', aktif: false },
    //{ isim: 'Samet Karadavut',tel: '905069246835', lid: '166838021427224@lid', rol: 'depo',   aktif: false },
    //{ isim: 'Zübeyir Al',     tel: '905388334754', lid: '189189131895032@lid', rol: 'depo',   aktif: false },
    //{ isim: 'Ayşen Akar',     tel: '905458437505', lid: '30361325187264@lid',  rol: 'kalite', aktif: false },
    //{ isim: 'Burcu Çiftci',   tel: '905424256418', lid: '80659519373322@lid',  rol: 'uretim', aktif: false },

    // ── WhatsApp Grupları ─────────────────────────────────────────
    //  komut: true → gruptaki yetkili kişiler // komut kullanabilir
    //  komut yok (varsayılan) → grup yalnızca rapor alır, komuta tepki vermez
    { isim: 'Efektif Grup',                 gid: '120363426206982516@g.us', rol: 'admin', aktif: false },
    { isim: 'CAPSSUN ÜRETİM',              gid: '120363159617899296@g.us', rol: 'uretim', aktif: false },
    { isim: 'EKSTRÜZYON HATTI CAPSSUN',    gid: '120363131062460842@g.us', rol: 'uretim', aktif: false },
    { isim: 'CAPSSUN TEKNİK OPERASYON',    gid: '120363029084429387@g.us', rol: 'bakim',  aktif: false },
    { isim: 'Üretim Planlama CPS',         gid: '120363420256542050@g.us', rol: 'uretim',  aktif: false },
    { isim: 'Üretim Kalite Onay',          gid: '120363301965065855@g.us', rol: 'kalite', aktif: false },
    { isim: 'Capssun Mikser',               gid: '120363148715962906@g.us', rol: 'mikser', aktif: true  },
    { isim: 'CAPSSUN Mikser Operasyonu',   gid: '120363406880579404@g.us', rol: 'mikser', aktif: false },
    { isim: 'Mikser Kalite Grubu',         gid: '120363419076368545@g.us', rol: 'mikser', aktif: true  },
  ],

  // baslangicSaat / bitisSaat → TR saati (BaslangicSaati zaten TR saati)
  // Debug'dan doğrulanan:
  //   Vardiya D = 16:00-00:00 (gece)
  //   Vardiya A = 00:00-08:00 (sabah)
  //   Vardiya B/C = 08:00-16:00 (gündüz) — hangisi olduğu henüz netleşmedi
  vardiyalar: [
    { no: 1, ad: 'Vardiya 1', baslangicSaat: 0,  bitisSaat: 8,  dbVardiya: 'A' },  // 00:00–07:59
    { no: 2, ad: 'Vardiya 2', baslangicSaat: 8,  bitisSaat: 16, dbVardiya: 'B' },  // 08:00–15:59
    { no: 3, ad: 'Vardiya 3', baslangicSaat: 16, bitisSaat: 24, dbVardiya: 'D' },  // 16:00–23:59
  ],

  raporGecikimeDakika: 5,

  // JWELL = EXT-1, GWELL = EXT-2 (senin doğruladığın)
  hatlar: {
    JWELL: 'EXT-1',
    GWELL: 'EXT-2',
  },

  vardiyaAmirleri: {
    A: 'Barış Öztürk',
    B: 'Selçuk Özmen',
    C: 'İbrahim Özen',
    D: 'İsmail Varol',
  },

  // Günlük hat başına m² hedefi — 0 bırakılırsa raporda gösterilmez
  uretimHedefleri: {
    'EXT-1': 0,
    'EXT-2': 0,
  },

  // ── Anlık İzleme ───────────────────────────────────────────
  //
  //  Her yoklamaAraligi dakikada bir üretim verisi kontrol edilir.
  //
  //  Uyarılar:
  //    • Üretim duruşu  → yalnızca admin
  //    • Eksik metraj   → admin + uretim
  //    • Ek ürün artışı → admin + uretim
  //
  anlikIzleme: {
    aktif:             true,
    yoklamaAraligi:    5,    // dakika (cron: her 5 dk)
    uretimDurmaEsigi:  60,   // dakika — bu süre kayıt gelmezse uyarı
    sonKacUrunBaksin:  10,   // ek ürün için rolling window boyutu
    ekUrunEsigi:       3,    // son N üründe bu kadar ek ürün → uyarı
    mikserBosaltmaSuresi: 5, // dakika — etiketler tek seferde çıktığından 5 dk yeterli
  },

  // Eşikleri aşınca yalnızca admin'e uyarı gönderilir
  uyariEsikleri: {
    eksikUrunEsigi:  3,    // bir vardiyada bu kadar eksik ürün → uyarı
    fireOraniEsigi:  10,   // % fire oranı bu değeri geçerse → uyarı
    vardiyaMinUrun:  2,    // bu sayının altında kayıt varsa üretim durması uyarısı
    // Ürün tipine göre hazır stok limitleri (kg) — bu değerin altına düşerse uyarı
    hazirStokLimitleri: {
      'EPE POE': 10000,
      'EPE EVA':  6000,
    },
  },
};
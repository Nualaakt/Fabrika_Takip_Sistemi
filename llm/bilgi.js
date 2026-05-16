// ══════════════════════════════════════════════════════════════
//  bilgi.js  –  Prosedür bilgi bankası (akıllı seçim)
//  Soruya en uygun 1-2 dosyayı bulur, max 4KB gönderir.
//  Böylece context küçük kalır → model hızlı yanıt verir.
// ══════════════════════════════════════════════════════════════

const fs   = require('fs');
const path = require('path');

const KLASOR      = path.join(__dirname, 'prosedurler');
const DATASET_YOL = path.join(__dirname, 'dataset.jsonl');
const MAX_CHAR    = 8000;

// Türkçe stopword listesi (anlamsız kelimeler skorlamayı bozmasın)
const STOPWORDS = new Set([
  'bir','bu','ve','ile','de','da','ki','ne','için','en','çok',
  'var','yok','olan','olan','gibi','daha','nasıl','nedir','neden',
  'kadar','her','biz','siz','ben','sen','onlar','bunu','şunu',
  'ama','veya','ya','hem','değil','mi','mu','mı','mü','the','bir',
]);

let belgeler = [];
let qaListesi = []; // dataset.jsonl'den yüklenen Q&A çiftleri

function qaListesiYukle() {
  try {
    if (!fs.existsSync(DATASET_YOL)) return;
    const satirlar = fs.readFileSync(DATASET_YOL, 'utf8').trim().split('\n');
    qaListesi = satirlar.map(s => { try { return JSON.parse(s); } catch(_) { return null; } }).filter(Boolean);
    console.log(`🧠 ${qaListesi.length} Q&A çifti yüklendi.`);
  } catch (err) {
    console.error('Q&A yükleme hatası:', err.message);
  }
}

// Soruya en yakın Q&A çiftlerini bul (basit kelime benzerliği)
function ilgiliQAlariGetir(soru) {
  if (qaListesi.length === 0) return '';
  const soruKelimeleri = new Set(Object.keys(kelimeFrekansOlustur(soru)));
  const eslesme = qaListesi
    .map(qa => {
      const qaKelimeleri = Object.keys(kelimeFrekansOlustur(qa.instruction));
      const puan = qaKelimeleri.filter(k => soruKelimeleri.has(k)).length;
      return { ...qa, puan };
    })
    .filter(qa => qa.puan >= 2)
    .sort((a, b) => b.puan - a.puan)
    .slice(0, 5); // En iyi 5 Q&A

  if (eslesme.length === 0) return '';
  const liste = eslesme.map(qa => `S: ${qa.instruction}\nC: ${qa.output}`).join('\n\n');
  console.log(`🧠 ${eslesme.length} ilgili Q&A bulundu.`);
  return `\n=== EĞİTİM VERİSİNDEN İLGİLİ SORULAR ===\n${liste}`;
}

function belgeleriYukle() {
  try {
    const dosyalar = fs.readdirSync(KLASOR).filter(f => f.match(/\.(txt|md)$/i));
    belgeler = dosyalar.map(dosya => {
      const icerik = fs.readFileSync(path.join(KLASOR, dosya), 'utf8');
      return {
        dosya,
        baslik: dosya.replace(/\.(txt|md)$/i, ''),
        icerik,
        // Tüm içerikten kelime frekans haritası oluştur
        frekans: kelimeFrekansOlustur(icerik + ' ' + dosya),
      };
    });
    console.log(`📚 ${belgeler.length} prosedür yüklendi.`);
  } catch (err) {
    console.error('Prosedür yükleme hatası:', err.message);
    belgeler = [];
  }
}

function kelimeFrekansOlustur(metin) {
  const frekans = {};
  metin.toLowerCase()
    .replace(/[^a-züğşıöçA-ZÜĞŞİÖÇ0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(k => k.length > 2 && !STOPWORDS.has(k))
    .forEach(k => { frekans[k] = (frekans[k] || 0) + 1; });
  return frekans;
}

// TF-IDF benzeri basit puanlama: sorudaki kelimeler belgede ne kadar geçiyor
function ilgiliBelgeleriGetir(soru) {
  if (belgeler.length === 0) return '';

  const soruKelimeleri = Object.keys(kelimeFrekansOlustur(soru));
  if (soruKelimeleri.length === 0) return '';

  const puanlar = belgeler.map(b => {
    let puan = 0;
    for (const k of soruKelimeleri) {
      if (b.frekans[k]) {
        // Dosya adında geçiyorsa 3x ağırlık
        const dosyaAdindaMi = b.dosya.toLowerCase().includes(k);
        puan += dosyaAdindaMi ? b.frekans[k] * 3 : b.frekans[k];
      }
    }
    return { ...b, puan };
  });

  const enIyi = puanlar
    .filter(b => b.puan > 0)
    .sort((a, b) => b.puan - a.puan)
    .slice(0, 2); // En iyi 2 dosya

  if (enIyi.length === 0) return '';

  let sonuc = '';
  let kalanChar = MAX_CHAR;
  for (const b of enIyi) {
    const icerik = b.icerik.length > kalanChar
      ? b.icerik.slice(0, kalanChar) + '\n[devamı kısaltıldı]'
      : b.icerik;
    console.log(`📚 Prosedür seçildi: "${b.baslik}" (puan: ${b.puan})`);
    sonuc += `\n=== PROSEDÜR: ${b.baslik} ===\n${icerik}`;
    kalanChar -= icerik.length;
    if (kalanChar <= 0) break;
  }
  return sonuc;
}

belgeleriYukle();
qaListesiYukle();

fs.watch(KLASOR, () => {
  console.log('📚 Prosedür klasörü değişti, yeniden yükleniyor...');
  setTimeout(belgeleriYukle, 500);
});

module.exports = { ilgiliBelgeleriGetir, ilgiliQAlariGetir };

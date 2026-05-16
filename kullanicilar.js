// ── kullanicilar.js — Dinamik kullanıcı yönetimi ─────────────
//
//  Kayıtlar: kullanicilar.json (kalıcı depolama)
//  Durum değerleri: 'bekliyor' | 'onaylandi' | 'reddedildi'
//
'use strict';

const fs   = require('fs');
const path = require('path');

const DOSYA = path.join(__dirname, 'kullanicilar.json');

// Birim adı → sistem rolü
const BIRIM_ROL = {
  '1': 'uretim', 'üretim': 'uretim', 'uretim': 'uretim',
  '2': 'mikser',  'mikser': 'mikser',
  '3': 'bakim',   'bakım': 'bakim',   'bakim': 'bakim',
  '4': 'depo',    'depo': 'depo',
  '5': 'kalite',  'kalite': 'kalite',
};

// Birim → otomatik pozisyon
const BIRIM_POZISYON = {
  uretim:  'Üretim Personeli',
  mikser:  'Mikser Personeli',
  bakim:   'Bakım Personeli',
  depo:    'Depo Personeli',
  kalite:  'Kalite Teknisyeni',
};

function pozisyonCoz(birim) {
  return BIRIM_POZISYON[birim] || birim;
}

function birimCoz(giris) {
  return BIRIM_ROL[(giris || '').trim().toLowerCase()] || null;
}

// ── Dosya okuma / yazma ────────────────────────────────────────
function yukle() {
  try {
    return JSON.parse(fs.readFileSync(DOSYA, 'utf8'));
  } catch {
    return { sonId: 0, kayitlar: [] };
  }
}

function kaydet(data) {
  fs.writeFileSync(DOSYA, JSON.stringify(data, null, 2), 'utf8');
}

// ── CRUD ───────────────────────────────────────────────────────
function bekleyenEkle({ isim, pozisyon, birim, chatId }) {
  const data = yukle();
  data.sonId = (data.sonId || 0) + 1;
  const kayit = {
    id:              data.sonId,
    isim,
    pozisyon,
    birim,           // sistem rolü ('uretim', 'mikser', ...)
    chatId,          // WhatsApp chat adresi (mesaj gönderim için)
    durum:           'bekliyor',
    aktif:           false,
    olusturmaTarihi: new Date().toISOString(),
  };
  data.kayitlar.push(kayit);
  kaydet(data);
  return kayit;
}

function onayla(id, aktif) {
  const data = yukle();
  const kayit = data.kayitlar.find(k => k.id === Number(id));
  if (!kayit || kayit.durum !== 'bekliyor') return null;
  kayit.durum = 'onaylandi';
  kayit.aktif = aktif;
  kayit.onayTarihi = new Date().toISOString();
  kaydet(data);
  return kayit;
}

function reddet(id) {
  const data = yukle();
  const kayit = data.kayitlar.find(k => k.id === Number(id));
  if (!kayit || kayit.durum !== 'bekliyor') return null;
  kayit.durum = 'reddedildi';
  kaydet(data);
  return kayit;
}

function bekleyenGetir(id) {
  const data = yukle();
  return data.kayitlar.find(k => k.id === Number(id) && k.durum === 'bekliyor') || null;
}

// Onaylanmış ve aktif kullanıcıları role göre getir
function aktifKullanicilar(rol) {
  const data = yukle();
  return data.kayitlar.filter(k => k.durum === 'onaylandi' && k.aktif && k.birim === rol);
}

// Tüm kayıtları özet olarak getir (admin listesi için)
function tumKayitlar() {
  return yukle().kayitlar;
}

module.exports = { birimCoz, pozisyonCoz, bekleyenEkle, onayla, reddet, bekleyenGetir, aktifKullanicilar, tumKayitlar };

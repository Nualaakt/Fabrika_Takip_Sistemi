# Güvenlik Notları — ATLAS Otomasyon Sitesi

## Mevcut durum (HTML seviyesinde uygulanabilenlerin tamamı uygulandı)

- **CSP (meta):** `default-src 'self'` + yalnızca cdnjs (script) ve Google Fonts (stil/font) izinli.
  `'unsafe-inline'` YOK — inline style/script tamamen temizlendi. Yeni kod eklerken
  inline `style="..."` veya gömülü `<script>` KULLANMA; sınıf ve harici dosya kullan
  (JSON-LD `application/ld+json` blokları serbesttir, çalıştırılmaz).
- **SRI:** GSAP CDN script'lerinde `integrity` + `crossorigin` var. GSAP sürümü
  değişirse hash'leri güncelle: https://api.cdnjs.com/libraries/gsap/<sürüm>?fields=sri
- **Çerez yok:** localStorage yalnızca tema tercihi (`atlas-theme`) ve intro bayrağı
  (`atlas-intro`, session) için. Çerez bandı gerekmiyor; KVKK metni bu beyana dayanıyor.
- **security.txt:** `/.well-known/security.txt` (Expires: 2027-07 — yılda bir yenile).
- **Form:** maxlength sınırları + KVKK onayı. Gönderim şimdilik mailto.

## Domain + Cloudflare/Netlify'a geçince eklenecekler (HTTP header — GitHub Pages veremiyor)

Cloudflare: Rules → Transform Rules → Modify Response Header (veya bir Worker).
Netlify: kök dizine `_headers` dosyası.

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; upgrade-insecure-requests
```

Header ile CSP verilince sayfalardaki `<meta http-equiv="Content-Security-Policy">`
satırları kaldırılabilir (header önceliklidir; ikisi birden kalırsa en katı olan uygulanır).

## Form backend bağlanınca (Formspree/Web3Forms vb.)

- CSP `connect-src` / `form-action` listesine servisin alan adını ekle.
- Bal küpü (honeypot) alanı + sunucu tarafı doğrulama ekle.
- KVKK onay zaman damgasını kayıt altına al (ispat yükü veri sorumlusunda).

## Analitik eklenince (çerezsiz: GoatCounter / Plausible)

- CSP `script-src` + `connect-src` listesine analitik alan adını ekle.
- KVKK metnindeki "çerez kullanmıyoruz" beyanı geçerli kalır (bu araçlar çerezsiz).

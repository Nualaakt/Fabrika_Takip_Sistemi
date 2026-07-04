/* ============================================================
   İletişim formu: modül ön doldurma + KVKK onay doğrulaması
   Geçici gönderim: e-posta istemcisini açar (mailto).
   Gerçek form servisi bağlanınca burası güncellenecek.
   ============================================================ */

(function () {
  var form = document.getElementById("contact-form");
  if (!form) return;

  /* Modül plakasından gelindiyse mesajı önceden doldur */
  var modul = new URLSearchParams(location.search).get("modul");
  if (modul) {
    var msgEl = document.getElementById("f-msg");
    if (msgEl && !msgEl.value) {
      msgEl.value = "İlgilendiğimiz modül: " + modul + "\n\n";
    }
  }

  document.getElementById("f-kvkk").addEventListener("change", function () {
    if (this.checked) document.getElementById("consent-error").hidden = true;
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = document.getElementById("f-name").value.trim();
    var company = document.getElementById("f-company").value.trim();
    var phone = document.getElementById("f-phone").value.trim();
    var msg = document.getElementById("f-msg").value.trim();
    var consent = document.getElementById("f-kvkk");
    var consentError = document.getElementById("consent-error");

    if (!consent.checked) {
      consentError.hidden = false;
      consent.focus();
      return;
    }
    consentError.hidden = true;

    if (!name || !msg) return;

    var body = "Ad Soyad: " + name + "\n" +
               "Firma: " + (company || "-") + "\n" +
               "Telefon: " + (phone || "-") + "\n\n" + msg;

    window.location.href = "mailto:iletisim@atlasotomasyon.com" +
      "?subject=" + encodeURIComponent("Keşif görüşmesi talebi — " + (company || name)) +
      "&body=" + encodeURIComponent(body);

    document.getElementById("form-note").hidden = false;
  });
})();

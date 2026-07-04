/* ============================================================
   Tema yönetimi: gece/gündüz modu
   <head> içinde senkron yüklenir — ilk boyamada yanlış tema
   görünmesin (flash) diye.
   ============================================================ */

(function () {
  var KEY = "atlas-theme";

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.textContent = theme === "dark" ? "◐ Gündüz" : "◐ Gece";
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    }
  }

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* gizli mod vb. */ }

  var theme = saved ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  document.documentElement.setAttribute("data-theme", theme);

  document.addEventListener("DOMContentLoaded", function () {
    apply(theme);
    var btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.addEventListener("click", function () {
        theme = document.documentElement.getAttribute("data-theme") === "dark"
          ? "light" : "dark";
        try { localStorage.setItem(KEY, theme); } catch (e) { /* yoksay */ }
        apply(theme);
      });
    }

    /* --- Hamburger menü (mobil) --- */
    var burger = document.getElementById("nav-burger");
    var nav = document.querySelector(".nav");
    if (burger && nav) {
      burger.addEventListener("click", function () {
        var open = nav.classList.toggle("is-open");
        burger.setAttribute("aria-expanded", open ? "true" : "false");
        burger.setAttribute("aria-label", open ? "Menüyü kapat" : "Menüyü aç");
        document.documentElement.classList.toggle("menu-lock", open);
      });

      /* Linke tıklanınca menü kapansın (aynı sayfa çapaları için) */
      nav.querySelectorAll(".nav__links a").forEach(function (a) {
        a.addEventListener("click", function () {
          nav.classList.remove("is-open");
          burger.setAttribute("aria-expanded", "false");
          document.documentElement.classList.remove("menu-lock");
        });
      });
    }
  });
})();

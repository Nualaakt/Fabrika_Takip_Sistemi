/* ============================================================
   Kaydırınca beliren bölümler.
   [data-reveal] öğeleri görünüme girince yumuşakça yükselir.
   JS yüklenmezse veya hareket azaltma açıksa içerik normal görünür.
   ============================================================ */

(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) return;

  var els = document.querySelectorAll("[data-reveal]");
  if (!els.length) return;

  els.forEach(function (el) {
    el.classList.add("js-reveal");

    /* Aynı kapsayıcıdaki kardeşler 70ms arayla gelsin (stagger) */
    var idx = 0;
    var prev = el.previousElementSibling;
    while (prev) {
      if (prev.hasAttribute("data-reveal")) idx++;
      prev = prev.previousElementSibling;
    }
    el.style.transitionDelay = Math.min(idx, 5) * 70 + "ms";
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  els.forEach(function (el) { io.observe(el); });
})();

/* ============================================================
   Giriş perdesi: fabrika takip sistemi devreye alma sekansı
   Başlık maskeli yükselir → modüller (Üretim/Bakım/Kalite/Depo)
   sırayla devreye girer → boot log + dev sayaç → perde ortadan
   ikiye ayrılır → hero kademeli girer.
   - Aynı oturumda tekrar gösterilmez (sessionStorage)
   - Hareket azaltmada ve GSAP yokken anında kaldırılır
   ============================================================ */

(function () {
  var intro = document.getElementById("intro");
  if (!intro) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var seen = false;
  try { seen = sessionStorage.getItem("atlas-intro") === "1"; } catch (e) { /* gizli mod */ }

  if (reduced || seen || typeof gsap === "undefined") {
    intro.remove();
    return;
  }

  try { sessionStorage.setItem("atlas-intro", "1"); } catch (e) { /* yoksay */ }

  /* Intro boyunca kaydırma kilitli — sahne animasyonu yarıda tetiklenmesin.
     NOT: scene.js bu dosyadan ÖNCE yüklenmeli; ScrollTrigger elemanların
     doğal (görünür) durumunu kaydetmiş olmalı. */
  document.documentElement.classList.add("intro-lock");

  /* Hero başlangıç durumları (intro sonrası girecekler) */
  var heroEls = ["#scene-hero .eyebrow", "#scene-hero h1", "#scene-hero p"];
  gsap.set(heroEls, { opacity: 0, y: 28 });
  gsap.set(["#chip", "#annot", "#scene-cue"], { opacity: 0 });

  /* Intro başlangıç durumları */
  gsap.set(["#intro-title-1", "#intro-title-2"], { yPercent: 112 });
  gsap.set("#intro-log div", { y: 8 });

  var counter = { v: 0 };
  var countEl = document.getElementById("intro-count");
  var modules = intro.querySelectorAll(".intro__module");
  var logLines = intro.querySelectorAll("#intro-log div");

  var tl = gsap.timeline();

  /* --- Başlık: maskeli yükselme --- */
  tl.to("#intro-title-1", { yPercent: 0, duration: 0.7, ease: "power4.out" }, 0.05)
    .to("#intro-title-2", { yPercent: 0, duration: 0.7, ease: "power4.out" }, 0.17);

  /* --- Sayaç + ilerleme çubuğu --- */
  tl.to(counter, {
      v: 100,
      duration: 2.3,
      ease: "power2.inOut",
      onUpdate: function () {
        countEl.textContent = "%" + Math.round(counter.v);
      }
    }, 0.15)
    .to("#intro-bar", { width: "100%", duration: 2.3, ease: "power2.inOut" }, 0.15);

  /* --- Modüller sırayla devreye girer (flicker etkisiyle) --- */
  modules.forEach(function (mod, i) {
    var at = 0.65 + i * 0.42;
    tl.to(mod, {
        opacity: 1,
        borderColor: "rgba(240, 83, 28, 0.85)",
        duration: 0.3,
        ease: "steps(4)"
      }, at)
      .to(mod.querySelector("em"), { opacity: 1, duration: 0.15 }, at + 0.16);
  });

  /* --- Boot log satırları --- */
  logLines.forEach(function (line, i) {
    tl.to(line, { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" }, 0.35 + i * 0.42);
  });

  /* --- Çıkış: içerik söner, perde ortadan ikiye ayrılır --- */
  tl.to("#intro-content", { autoAlpha: 0, scale: 0.985, duration: 0.35, ease: "power1.in" }, 2.75)
    .to(".intro__half--top",    { yPercent: -100, duration: 0.85, ease: "power4.inOut" }, 2.95)
    .to(".intro__half--bottom", { yPercent: 100,  duration: 0.85, ease: "power4.inOut" }, 2.95);

  /* --- Hero girişi: çip, metinler, notlar sırayla --- */
  tl.to("#chip", { opacity: 1, duration: 0.5, ease: "power1.out" }, 3.25)
    .to(heroEls, {
      opacity: 1,
      y: 0,
      duration: 0.6,
      stagger: 0.12,
      ease: "power3.out"
    }, 3.35)
    .to("#annot", { opacity: 1, duration: 0.5 }, 3.7)
    .to("#scene-cue", { opacity: 1, duration: 0.4 }, 3.85)
    .add(function () {
      document.documentElement.classList.remove("intro-lock");
      intro.remove();
    });
})();

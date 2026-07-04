/* ============================================================
   ATLAS OTOMASYON — ana sayfa kurulum animasyonu
   Çip → bileşenler → izler → fabrika (GSAP ScrollTrigger, scrub)
   ============================================================ */

(function () {
  var scene = document.getElementById("scene");
  if (!scene || typeof gsap === "undefined") return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  gsap.registerPlugin(ScrollTrigger);

  /* Başlangıç durumları */
  gsap.set("#comp-sensor", { x: -420, opacity: 0 });
  gsap.set("#comp-net",    { x: 420,  opacity: 0 });
  gsap.set("#comp-server", { x: -420, opacity: 0 });
  gsap.set("#comp-app",    { x: 420,  opacity: 0 });
  gsap.set("#vias circle", { scale: 0, opacity: 0 });
  gsap.set(["#panel-1", "#panel-2", "#panel-3", "#panel-4"], { y: 26 });

  /* via seçici: 1-2 sensör, 3-4 ağ, 5-6 sunucu, 7-8 uygulama */
  function vias(a, b) {
    return ["#vias circle:nth-of-type(" + a + ")", "#vias circle:nth-of-type(" + b + ")"];
  }

  var tl = gsap.timeline({
    defaults: { ease: "none" }
  });

  /* --- Aşama 0: açılış metni ve ölçü notları çekilir --- */
  tl.to("#scene-hero", { opacity: 0, y: -60, duration: 0.06, ease: "power1.in" }, 0.01)
    .to("#scene-cue",  { opacity: 0, duration: 0.03 }, 0.01)
    .to("#annot",      { opacity: 0, duration: 0.04 }, 0.02);

  /* --- Aşama 1: sensör bağlanır --- */
  tl.to("#comp-sensor", { x: 0, opacity: 1, duration: 0.07, ease: "back.out(1.6)" }, 0.08)
    .to("#trace-sensor", { strokeDashoffset: 0, duration: 0.06, ease: "power1.inOut" }, 0.14)
    .to(vias(1, 2), { scale: 1, opacity: 1, duration: 0.03, ease: "back.out(2.5)" }, 0.17)
    .to("#flow-sensor", { opacity: 0.95, duration: 0.03 }, 0.20)
    .to("#panel-1", { autoAlpha: 1, y: 0, duration: 0.03, ease: "power2.out" }, 0.13)
    .to("#panel-1", { autoAlpha: 0, y: -18, duration: 0.03, ease: "power1.in" }, 0.24);

  /* --- Aşama 2: ağ + sunucu bağlanır --- */
  tl.to("#comp-net",    { x: 0, opacity: 1, duration: 0.07, ease: "back.out(1.6)" }, 0.26)
    .to("#trace-net",    { strokeDashoffset: 0, duration: 0.06, ease: "power1.inOut" }, 0.31)
    .to(vias(3, 4), { scale: 1, opacity: 1, duration: 0.03, ease: "back.out(2.5)" }, 0.34)
    .to("#flow-net", { opacity: 0.95, duration: 0.03 }, 0.37)
    .to("#comp-server", { x: 0, opacity: 1, duration: 0.07, ease: "back.out(1.6)" }, 0.30)
    .to("#trace-server", { strokeDashoffset: 0, duration: 0.06, ease: "power1.inOut" }, 0.36)
    .to(vias(5, 6), { scale: 1, opacity: 1, duration: 0.03, ease: "back.out(2.5)" }, 0.39)
    .to("#flow-server", { opacity: 0.95, duration: 0.03 }, 0.42)
    .to("#panel-2", { autoAlpha: 1, y: 0, duration: 0.03, ease: "power2.out" }, 0.33)
    .to("#panel-2", { autoAlpha: 0, y: -18, duration: 0.03, ease: "power1.in" }, 0.44);

  /* --- Aşama 3: uygulama bağlanır --- */
  tl.to("#comp-app",  { x: 0, opacity: 1, duration: 0.07, ease: "back.out(1.6)" }, 0.46)
    .to("#trace-app",  { strokeDashoffset: 0, duration: 0.06, ease: "power1.inOut" }, 0.51)
    .to(vias(7, 8), { scale: 1, opacity: 1, duration: 0.03, ease: "back.out(2.5)" }, 0.54)
    .to("#flow-app", { opacity: 0.95, duration: 0.03 }, 0.57)
    .to("#panel-3", { autoAlpha: 1, y: 0, duration: 0.03, ease: "power2.out" }, 0.50)
    .to("#panel-3", { autoAlpha: 0, y: -18, duration: 0.03, ease: "power1.in" }, 0.60);

  /* --- Aşama 4: montaj küçülür, fabrika çizilir ---
     Dönüşüm geniş bir aralığa yayılır ve çizimlerle iç içe akar,
     böylece "çip → fabrika" geçişi tek hamlelik hissettirmez. */
  tl.to("#assembly", {
      scale: 0.34,
      y: 168,
      svgOrigin: "600 400",
      duration: 0.17,
      ease: "power3.inOut"
    }, 0.60)
    .to("#factory", { opacity: 1, duration: 0.01 }, 0.62)
    .to("#factory-ground",  { strokeDashoffset: 0, duration: 0.08, ease: "power1.out" }, 0.63)
    .to("#factory-outline", { strokeDashoffset: 0, duration: 0.14, ease: "power1.inOut" }, 0.67)
    .to("#factory-chimney", { strokeDashoffset: 0, duration: 0.05 }, 0.80)
    .to("#factory-door",    { strokeDashoffset: 0, duration: 0.04 }, 0.85)
    .to("#factory-windows rect", {
      fillOpacity: 0.85,
      duration: 0.02,
      stagger: 0.015,
      ease: "power1.in"
    }, 0.88)
    .to("#factory-label",   { opacity: 1, duration: 0.03 }, 0.90)
    .to("#smoke",           { opacity: 1, duration: 0.03 }, 0.92)
    .to("#panel-4", { autoAlpha: 1, y: 0, duration: 0.03, ease: "power2.out" }, 0.90);

  /* Zaman çizelgesini tam 1.0'a sabitle: pozisyonlar scroll ilerlemesiyle
     birebir eşleşsin (yoksa GSAP süreyi son tween'e göre normalleştirir) */
  tl.to({}, { duration: 0.001 }, 0.999);

  if (reduced) {
    /* Hareket azaltma: animasyonsuz, doğrudan son kare + akış halinde paneller */
    document.body.classList.add("reduced-motion");
    gsap.set("#scene-hero", { clearProps: "all" });
    tl.progress(1).pause();
    gsap.set(["#scene-hero", "#annot"], { opacity: 1, y: 0 });
    return;
  }

  /* Kaydırma bırakıldığında en yakın "anlamlı durağa" yerleş:
     0 açılış · 0.19 sensör · 0.39 altyapı · 0.56 uygulama · 1 fabrika.
     Yarım kalmış geçiş görüntüsünü engeller. */
  /* Uzun scroll mesafesi = her aşamaya geniş alan, acele etmeyen tempo.
     Snap yavaş ve yumuşak süzülür — koşturmaz. */
  ScrollTrigger.create({
    animation: tl,
    trigger: scene,
    start: "top top",
    end: "+=6200",
    scrub: 1.2,
    pin: true,
    anticipatePin: 1,
    snap: {
      snapTo: [0, 0.19, 0.39, 0.56, 1],
      duration: { min: 0.6, max: 1.6 },
      delay: 0.15,
      ease: "power1.inOut",
      inertia: false
    }
  });
})();

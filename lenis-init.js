/* ============================================================
   F1 Ebikes - smooth momentum scrolling (Lenis)
   Eases the NATIVE scroll, so scroll-driven animations (the hero canvas scrub) keep reading
   window.scrollY normally and position:sticky still works. The hero slingshot routes its
   springs through window.lenis.scrollTo so they share this momentum easing. Disabled when the
   user prefers reduced motion, and only enabled for fine pointers (desktop) - touch devices
   already have native momentum.
   ============================================================ */
(function () {
  if (typeof Lenis === "undefined") return;
  if (F1.reducedMotion()) return;

  var lenis = new Lenis({
    // On the homepage the hero tuning sets F1_TUNE.lerp (a long cinematic glide) and the hero
    // script manages it per-scroll. Every other page has no F1_TUNE, so use a tight, responsive
    // everyday smooth-scroll here instead of the floaty hero value.
    lerp: (window.F1_TUNE && typeof window.F1_TUNE.lerp === "number") ? window.F1_TUNE.lerp : 0.14,

    smoothWheel: true,
    wheelMultiplier: 0.95,
    touchMultiplier: 1.6
  });
  window.lenis = lenis;                                               // shared with the hero slingshot

  function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
})();

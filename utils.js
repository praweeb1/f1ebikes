/* ============================================================
   F1 Ebikes — shared micro-utilities (window.F1)
   Dependency-free and side-effect-free beyond attaching window.F1.
   These were previously duplicated across hero-bg-sync.js, hero-loader.js,
   tune-panel.js, review-wall.js, collection.js and lenis-init.js.
   MUST load before any script that references F1.* — it is placed as the
   first local <script> on every page.
   ============================================================ */
(function (w) {
  var F1 = (w.F1 = w.F1 || {});
  // clamp a value into the [0, 1] range
  F1.clamp01 = function (x) { return x < 0 ? 0 : (x > 1 ? 1 : x); };
  // linear interpolate from a to b by t
  F1.lerp = function (a, b, t) { return a + (b - a) * t; };
  // smootherstep easing (Perlin): 0..1 -> 0..1, flat 1st & 2nd derivatives at the ends
  F1.smootherstep = function (t) { return t * t * t * (t * (t * 6 - 15) + 10); };
  // true when the OS "reduce motion" preference is set
  F1.reducedMotion = function () { return w.matchMedia("(prefers-reduced-motion: reduce)").matches; };
})(window);

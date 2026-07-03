/* ============================================================
   F1 Ebikes - Riders section (homepage reviews)
   One-shot scroll-in reveal + stat count-up. IntersectionObserver
   adds `.is-in` (CSS drives the staggered reveal); the two big
   stats count up to their data-to values. No dependencies.
   Respects reduced motion: final state rendered instantly.
   ============================================================ */
(function () {
  var section = document.querySelector(".riders");
  if (!section) return;

  var reduce =
    (window.F1 && typeof F1.reducedMotion === "function" && F1.reducedMotion()) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var vals = section.querySelectorAll(".riders__stat-val");

  function fmt(n, dec) {
    return Number(n).toLocaleString("en-US", {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  }

  function setFinal() {
    vals.forEach(function (el) {
      var to = parseFloat(el.getAttribute("data-to"));
      var dec = parseInt(el.getAttribute("data-dec"), 10) || 0;
      el.textContent = fmt(to, dec);
    });
  }

  function countUp() {
    var dur = 1400, start = null;
    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1), e = easeOutCubic(p);
      vals.forEach(function (el) {
        var to = parseFloat(el.getAttribute("data-to"));
        var dec = parseInt(el.getAttribute("data-dec"), 10) || 0;
        el.textContent = fmt(to * e, dec);
      });
      if (p < 1) requestAnimationFrame(frame);
      else setFinal();
    }
    requestAnimationFrame(frame);
  }

  // Reduced motion: skip the show, render the end state.
  if (reduce) {
    section.classList.add("riders--static", "is-in");
    setFinal();
    return;
  }

  var fired = false;
  function reveal() {
    if (fired) return;
    fired = true;
    section.classList.add("is-in");
    countUp();
  }

  // No IO support: just show it.
  if (!("IntersectionObserver" in window)) { reveal(); return; }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { reveal(); io.disconnect(); }
    });
  }, { threshold: 0.3 });
  io.observe(section);
})();

/* ============================================================
   F1 Ebikes - battery intro loader
   A small, centred battery that charges red -> orange -> yellow -> green while the hero's 360-frame
   scrub sequence decodes (progress read from window.F1_FRAMES, set by hero-bg-sync.js). Scroll is
   locked until the frames are ready, so the opening scrub is silky from the first wheel-tick; then
   the loader dissolves into the hero. Mobile/iOS (no scrub preload) gets a brief timed charge.
   Hard failsafes guarantee it NEVER locks the page forever.
   ============================================================ */
(function () {
  var loader = document.getElementById("batt-loader");
  if (!loader) return;
  var fill   = document.getElementById("btl-fill");
  var cap    = document.getElementById("btl-cap");
  var pctEl  = document.getElementById("btl-pct");
  var labelT = document.getElementById("btl-label");
  var root   = document.documentElement;

  // On mobile / iOS the hero is a plain autoplay clip (is-lite mode) - there are no
  // scrub frames to decode, so the intro loader only adds startup delay. Skip it
  // entirely on phones: remove the loader and never lock scroll. Same detection as
  // hero-bg-sync.js's lite path so the two stay in sync.
  var isIOS = /iP(hone|ad|od)/i.test(navigator.userAgent) ||
              (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (window.matchMedia("(max-width: 860px)").matches || isIOS) {
    if (loader.parentNode) loader.parentNode.removeChild(loader);
    return;   // returns before batt-locked is ever added - scroll is free from the start
  }

  var reduce = F1.reducedMotion();
  var done = false;

  function hide() {
    loader.classList.add("is-hidden");
    setTimeout(function () { if (loader) loader.style.display = "none"; }, 800);
  }
  function reveal() {
    root.classList.remove("batt-locked");
    // hero-bg-sync.js sized its scroll track + canvas while the page was locked (collapsed
    // height), so the hero is still on its charcoal placeholder. Nudge it to re-measure and
    // repaint now that the page can scroll again, then dissolve the loader.
    requestAnimationFrame(function () { window.dispatchEvent(new Event("resize")); });
    setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 260);
    hide();
  }

  // lock the page while the hero loads
  root.classList.add("batt-locked");
  // absolute failsafe - if anything stalls, never trap the user behind the loader
  var FAILSAFE = setTimeout(function () { if (!done) { done = true; reveal(); } }, 16000);

  if (reduce) {
    done = true; clearTimeout(FAILSAFE);
    if (pctEl) pctEl.textContent = "100";
    reveal();
    return;
  }

  var clamp01 = F1.clamp01;

  // red -> orange -> yellow -> green, switching each quarter
  function stage(p) {
    if (p < 0.25) return { c: "#f0463f", g: "240,70,63" };
    if (p < 0.50) return { c: "#f5872f", g: "245,135,47" };
    if (p < 0.75) return { c: "#f4c233", g: "244,194,51" };
    return            { c: "#2fcf72", g: "47,207,114" };
  }
  var curStage = "", baseShadow = "", pulseT = 0;
  function applyColor(p) {
    var s = stage(p);
    if (s.c === curStage) return;
    var first = curStage === "";
    curStage = s.c;
    baseShadow = "0 0 20px rgba(" + s.g + ",0.5), 0 0 6px rgba(" + s.g + ",0.4)";
    fill.style.background = s.c;
    cap.style.background = "rgba(" + s.g + ",0.85)";
    if (first) { fill.style.boxShadow = baseShadow; return; }
    fill.style.boxShadow = "0 0 34px rgba(" + s.g + ",0.95), 0 0 12px rgba(" + s.g + ",0.65)";
    clearTimeout(pulseT);
    pulseT = setTimeout(function () { if (!done) fill.style.boxShadow = baseShadow; }, 280);
  }

  // progress source: real frame decode (desktop scrub) or -1 when unknown (mobile/lite)
  function frac() {
    var F = window.F1_FRAMES;
    if (F && F.total) return clamp01(F.loaded / F.total);
    return -1;
  }

  var MIN_MS = 1100, MAX_MS = 13000;
  var start = 0, raf = 0, shown = 0;

  function isReady(elapsed) {
    var f = frac();
    if (f < 0) return elapsed >= 2400;                  // mobile/lite: short, then reveal
    if (f >= 0.999 && elapsed >= MIN_MS) return true;   // everything decoded
    if (f >= 0.92 && elapsed >= 6500) return true;      // don't hang on a few stragglers
    return elapsed >= MAX_MS;                            // failsafe
  }

  function loop(now) {
    if (!start) start = now;
    var elapsed = now - start;
    var f = frac();
    var target;
    if (f < 0) { target = clamp01(elapsed / 2400); }
    else { target = Math.max(f, clamp01(elapsed / 4200) * 0.9); }   // always breathe

    var rdy = isReady(elapsed);
    if (!rdy) target = Math.min(target, 0.99);          // 100% only once truly ready
    shown += (target - shown) * 0.09;
    if (rdy) shown += (1 - shown) * 0.14;

    var p = clamp01(shown);
    fill.style.width = (p * 100).toFixed(1) + "%";
    applyColor(p);
    pctEl.textContent = rdy ? Math.round(p * 100) : Math.min(99, Math.round(p * 100));

    if (rdy && p > 0.999) { finish(); return; }
    raf = requestAnimationFrame(loop);
  }

  function finish() {
    if (done) return;
    done = true; clearTimeout(FAILSAFE);
    applyColor(1);
    fill.style.width = "100%";
    pctEl.textContent = "100";
    fill.style.boxShadow = "0 0 28px rgba(47,207,114,0.8), 0 0 10px rgba(47,207,114,0.55)";
    cap.style.background = "rgba(47,207,114,0.95)";
    if (labelT) { labelT.textContent = "Ready"; labelT.style.color = "#cfeede"; }
    loader.classList.add("is-charged");                 // stop the shimmer + pop the battery
    setTimeout(reveal, 420);                            // a short beat on full, then dissolve
  }

  applyColor(0);
  raf = requestAnimationFrame(loop);
})();

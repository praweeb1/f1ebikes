/* ============================================================
   F1 Ebikes — scroll-controlled bike reveal (transparent sequence)
   One pinned section. A 60-frame TRANSPARENT PNG sequence of the
   bike (assets/bike-seq/frame-001..060.png) rotates from a head-on
   FRONT close-up to the full right-side PROFILE as you scroll, with
   a zoom pull-back layered on top. The background is a SEPARATE
   scroll-driven gradient painted behind the cut-out bike — dim
   dark-graphite when zoomed in, brightening to a lighter grey as
   the full side shot lands. Scroll-driven via GSAP ScrollTrigger.
   ============================================================ */
(function () {
  const canvas = document.getElementById("reveal-canvas");
  const counter = document.getElementById("reveal-counter");
  const intro = document.getElementById("reveal-intro");
  const stage = document.getElementById("reveal-stage");
  if (!canvas || typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  gsap.registerPlugin(ScrollTrigger);
  const ctx = canvas.getContext("2d", { alpha: false });

  // ---- config ----
  const FRAME_COUNT = 60;                            // transparent PNG frames, front -> side
  const DISPLAY_TOTAL = 60;                          // decorative counter reads /60
  const FOLDER = "assets/bike-seq";                  // real-alpha cut-outs
  const frameURL = (i) => `${FOLDER}/frame-${String(i + 1).padStart(3, "0")}.jpg`;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Zoom pull-back layered on top of the rotation. ZOOM_START = scale at the start (tight
  // head-on close-up), ZOOM_END = scale at the end (full side profile). ZOOM_END < 1 leaves
  // comfortable whitespace so the final side shot never crowds the frame edge. Centred.
  const ZOOM_START = 1.45;
  const ZOOM_END = 0.92;

  // Background gradient stops (top + bottom), interpolated by scroll progress.
  // p = 0 -> dim dark graphite (zoomed in);  p = 1 -> lighter grey (full side shot).
  const TOP_DIM = [19, 20, 23],   BOT_DIM = [29, 30, 33];
  const TOP_LIT = [60, 64, 71],   BOT_LIT = [86, 91, 99];

  const pad2 = (n) => String(n).padStart(2, "0");
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (c1, c2, t) =>
    "rgb(" + Math.round(lerp(c1[0], c2[0], t)) + "," +
             Math.round(lerp(c1[1], c2[1], t)) + "," +
             Math.round(lerp(c1[2], c2[2], t)) + ")";

  // ---- preload the whole transparent sequence before the user reaches the section ----
  const images = [];
  let firstReady = false;
  let loadedCount = 0;
  for (let i = 0; i < FRAME_COUNT; i++) {
    const img = new Image();
    img.decoding = "async";
    const done = () => {
      if (i === 0) { firstReady = true; draw(); }
      if (++loadedCount === FRAME_COUNT && typeof settle === "function") settle();
    };
    img.onload = done;
    img.onerror = done;
    img.src = frameURL(i);
    images[i] = img;
  }

  // ---- draw: gradient background + zoomed transparent frame (object-fit: contain) ----
  const state = { p: 0 };                            // 0 -> 1 scroll progress
  let cw = 0, ch = 0;
  function draw() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(1, Math.round(rect.width * dpr));
    const H = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";              // best interpolation while zoomed in
    cw = rect.width;
    ch = rect.height;

    const p = Math.max(0, Math.min(1, state.p));
    const gp = p * p * (3 - 2 * p);                  // smoothstep for the lighting ramp

    // --- background gradient (the bike's bg, completely separate from the cut-out) ---
    const g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, mix(TOP_DIM, TOP_LIT, gp));
    g.addColorStop(1, mix(BOT_DIM, BOT_LIT, gp));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
    // soft light pool that "comes up" under the bike as the full side shot lands
    const glow = ctx.createRadialGradient(cw * 0.5, ch * 0.6, ch * 0.04, cw * 0.5, ch * 0.6, ch * 0.78);
    glow.addColorStop(0, "rgba(165,171,181," + (0.22 * gp).toFixed(3) + ")");
    glow.addColorStop(1, "rgba(165,171,181,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, cw, ch);

    const idx = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(p * (FRAME_COUNT - 1))));
    const img = images[idx];
    if (!img || !img.complete || !img.naturalWidth) return;

    // contain base: guarantees the final side profile shows the WHOLE bike with margin
    const baseScale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    // scroll-driven pull-back: tight close-up at the start, eased to full contain by the end
    const ease = Math.pow(1 - p, 1.3);               // 1 at start -> 0 at end
    const zoom = ZOOM_END + (ZOOM_START - ZOOM_END) * ease;
    const scale = baseScale * zoom;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const dx = (cw - w) / 2;                          // centred horizontally + vertically
    const dy = (ch - h) / 2;
    ctx.drawImage(img, dx, dy, w, h);
  }

  function updateCounter() {
    if (!counter) return;
    const n = Math.round(state.p * (DISPLAY_TOTAL - 1)) + 1;
    counter.textContent = pad2(n) + " / " + DISPLAY_TOTAL;
  }

  const SCRUB = reduceMotion ? true : 1.1;           // higher = smoother scroll catch-up
  const onScrub = () => { draw(); updateCounter(); };

  // Scroll budget: SCRUB_VH rotates front -> full side shot, then the stage holds PINNED
  // for a short HOLD_VH so the finished side shot lingers before the page ends.
  const SCRUB_VH = 2.4;
  const HOLD_VH = 1.0;
  const PIN_VH = SCRUB_VH + HOLD_VH;
  const LEAD = 0.05;                                  // brief opening hold (intro visible)

  // PIN the stage for the rotation + the hold.
  ScrollTrigger.create({
    trigger: ".reveal__stage",
    start: "top top",
    end: () => "+=" + window.innerHeight * PIN_VH,
    pin: true,
    pinSpacing: true,
    invalidateOnRefresh: true,
  });

  // SINGLE timeline — maps scroll progress (0 -> 1) over SCRUB_VH only.
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: ".reveal",
      start: "top top",
      end: () => "+=" + window.innerHeight * SCRUB_VH,
      scrub: SCRUB,
      invalidateOnRefresh: true,
    },
    onUpdate: onScrub,
  });
  tl.to({}, { duration: LEAD });                                       // lead-in hold
  tl.to(state, { p: 1, duration: 1 - LEAD });                         // front -> full side
  if (intro) tl.to(intro, { opacity: 0, y: -24, duration: 0.08, ease: "power2.out" }, 0.04);

  // ---- recalc on resize + settle ----
  function settle() { draw(); ScrollTrigger.refresh(); }
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(settle, 150); });
  window.addEventListener("load", () => { settle(); setTimeout(settle, 400); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
  draw();
  if (firstReady) draw();
  requestAnimationFrame(() => requestAnimationFrame(settle));
})();

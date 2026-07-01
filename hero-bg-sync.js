/* ============================================================
   F1 Ebikes - hero bike-sequence scrub (CANVAS image sequence) + dock + bg sync
   The 60-frame studio sequence (assets/bike-seq/frame-001..060.jpg - front-on charcoal to
   side-profile white) is scrubbed on a <canvas> by scroll. Drawing pre-decoded frames is
   instant (no video-seek latency), so the scrub is immediate and smooth.

   The bike sequence is mapped to the FIRST ~10% of total page scroll: the .videosec track is
   sized so its pinned scroll == 10% of the document's scrollable height. Once the sequence
   completes it docks to the bottom-right and the section releases - the rest of the page then
   scrolls normally, no longer driving the bike. Mobile/iOS skip the scrub (light Eb1ke clip).

   Performance: pre-decoded frames, render driven by Lenis's frame-synced scroll callback (no
   second smoothing pass), gated draws (only redraw when the frame/colour/dock actually changes).
   ============================================================ */
(function () {
  var canvas     = document.getElementById("hero-canvas");     // studio scrub (canvas frames)
  var mainVideo  = document.getElementById("main-video");      // Eb1ke full-screen
  var section    = document.getElementById("videosec");
  var sticky     = section && section.querySelector(".videosec__sticky");
  var nav        = document.getElementById("nav");
  var collection = document.getElementById("collection");
  var content    = document.getElementById("videosec-content");
  var overlay    = section && section.querySelector(".videosec__overlay");
  var dim        = section && section.querySelector(".videosec__dim");
  var socials    = document.getElementById("socials-video");
  var takeover   = document.getElementById("videosec-takeover");
  var pipLabel   = document.getElementById("pip-label");
  if (!canvas || !section || !sticky) return;

  // --- TEMP live-tuning hook (read each frame from window.F1_TUNE; see tune-panel.js) ---
  var TUNE = (window.F1_TUNE = window.F1_TUNE || {});
  function tnum(key, dflt) { var v = TUNE[key]; return (typeof v === "number" && !isNaN(v)) ? v : dflt; }

  var clamp01 = F1.clamp01;
  var smoother = F1.smootherstep;   // smootherstep (silky)
  var lerp = F1.lerp;
  function easeOutSnap(t) { return 1 - Math.pow(1 - t, 3); }   // easeOutCubic - quick spring-back, smooth settle

  // ---- Mobile / iOS fallback ----
  // Canvas scrub is desktop-only here; phones get the lightweight autoplay Eb1ke clip (and the
  // 60 frames are never even requested on mobile data). iPadOS 13+ reports platform "MacIntel".
  var isIOS = /iP(hone|ad|od)/i.test(navigator.userAgent) ||
              (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var smallOrIOS = window.matchMedia("(max-width: 860px)").matches || isIOS;
  var FORCE_LITE = false;
  if (FORCE_LITE || smallOrIOS) {
    document.documentElement.classList.add("is-lite");
    window.F1_HERO_MODE = "lite";   // no 360-frame scrub on phones - the loader won't gate on frames
    if (mainVideo) {
      var msrc = mainVideo.querySelector("source");
      if (msrc && smallOrIOS) { msrc.setAttribute("src", "assets/eb1ke-mobile.mp4"); }
      mainVideo.muted = true;
      mainVideo.load();
      mainVideo.style.opacity = "1";
      var tryPlay = function () { var p = mainVideo.play(); if (p && p.catch) p.catch(function () {}); };
      mainVideo.addEventListener("canplay", tryPlay, { once: true });
      tryPlay();
      document.addEventListener("touchstart", tryPlay, { once: true, passive: true });
    }
    if (nav && collection) {
      var syncNav = function () {
        var band = nav.getBoundingClientRect().height || 72;
        var cr = collection.getBoundingClientRect();
        nav.classList.toggle("nav--dark", cr.top <= band && cr.bottom > band);
      };
      syncNav();
      window.addEventListener("scroll", syncNav, { passive: true });
      window.addEventListener("resize", syncNav);
    }
    return;
  }

  // ============================================================
  // DESKTOP - canvas image-sequence scrub
  // Within the section's 0..1 progress:
  //   pa (scrub) 0..1 over [0, HANDOFF]      -> draws frames front -> side
  //   pb (dock)  0..1 over [HANDOFF, DOCK_END] -> shrinks to the bottom-right corner
  // ============================================================
  var FRAME_COUNT = 360;     // every native source frame -> maximally smooth scrub
  var HANDOFF_BASE  = 0.67;  // scrub completes / commits here (share of the *animated* track)
  var DOCK_END_BASE = 0.9;   // bike fully docked + "Socials" overlay shown here (higher = slower 16:9->9:16 dock)
  var HOLD_VH = 0.6125;      // extra screens of pure "nothing" scroll AFTER the dock, before the kits
  var HANDOFF  = HANDOFF_BASE;   // live values - recomputed in fitTrack() once the hold is appended
  var DOCK_END = DOCK_END_BASE;
  var kVal = 1;                  // page-scale (baseScroll/newScroll), set in fitTrack(); maps gp -> base fraction

  // ---- preload the frames (pre-decoded so draws are instant) ----
  // Decode progress is exposed on window.F1_FRAMES so the headlight loader (hero-loader.js) can
  // gate scroll until the opening frames are ready, then reveal the front-view hero.
  window.F1_HERO_MODE = "scrub";
  var frameURL = function (n) { return "assets/bike-seq-360/frame-" + String(n).padStart(3, "0") + ".jpg"; };
  var images = new Array(FRAME_COUNT);
  var framesLoaded = 0;
  window.F1_FRAMES = { loaded: 0, total: FRAME_COUNT };
  function frameDone() { framesLoaded++; window.F1_FRAMES.loaded = framesLoaded; }
  for (var i = 0; i < FRAME_COUNT; i++) {
    var im = new Image();
    im.decoding = "async";
    im.onload = function () { frameDone(); requestRender(); }; // a freshly-decoded frame may be the one on screen
    im.onerror = frameDone;                                    // never stall the loader on a missing frame
    im.src = frameURL(i + 1);
    images[i] = im;
  }

  // ---- canvas ----
  var ctx = canvas.getContext("2d", { alpha: false });
  var lastFrame = -1;
  function sizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.round(window.innerWidth  * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.fillStyle = "#414141";                 // charcoal so there's no black flash pre-decode
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    lastFrame = -1;                            // force a redraw at the new size
  }
  function drawFrame(idx) {
    if (idx === lastFrame) return;             // gate: skip redundant draws
    var img = images[idx];
    if (!img || !img.naturalWidth) return;     // not decoded yet - keep the previous frame
    lastFrame = idx;
    var W = canvas.width, H = canvas.height;
    var s = Math.max(W / img.naturalWidth, H / img.naturalHeight);   // object-fit: cover
    var dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  // ---- top-edge background colour of the sequence across playback ----
  var STOPS = [
    [0.00,  65,  65,  65], [0.17,  67,  67,  67], [0.25,  67,  67,  67], [0.33,  84,  84,  84],
    [0.42, 125, 125, 125], [0.50, 159, 159, 159], [0.58, 182, 182, 182], [0.67, 213, 213, 213],
    [0.75, 226, 225, 225], [0.83, 234, 233, 233], [0.92, 237, 236, 236], [1.00, 237, 236, 236]
  ];
  function rgbOf(s) { return [s[1], s[2], s[3]]; }
  function colorAt(p) {
    var n = STOPS.length;
    if (p <= STOPS[0][0]) return rgbOf(STOPS[0]);
    if (p >= STOPS[n - 1][0]) return rgbOf(STOPS[n - 1]);
    for (var i = 1; i < n; i++) {
      if (p <= STOPS[i][0]) {
        var a = STOPS[i - 1], b = STOPS[i], t = (p - a[0]) / (b[0] - a[0]);
        return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
      }
    }
    return rgbOf(STOPS[n - 1]);
  }

  var lastBg = "", lastDark = null;
  function paint(pa, pb) {
    var c = colorAt(pa);
    var rgb = "rgb(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + ")";
    if (rgb !== lastBg) { lastBg = rgb; section.style.setProperty("--hero-background", rgb); }
    if (nav) {
      var band = nav.getBoundingClientRect().height || 72;
      var rect = section.getBoundingClientRect();
      var dark = (rect.top <= band && rect.bottom > band) && c[0] > 140 && pb < 0.5;
      if (!dark && collection) {
        var cr = collection.getBoundingClientRect();
        if (cr.top <= band && cr.bottom > band) dark = true;
      }
      if (dark !== lastDark) { lastDark = dark; nav.classList.toggle("nav--dark", dark); }
    }
  }

  function setRect(el, left, top, w, h) {
    if (!el) return;
    el.style.left = left + "px"; el.style.top = top + "px";
    el.style.width = w + "px";  el.style.height = h + "px";
  }

  // Shrink the docked bike (canvas, holding the final side frame) into a 9:16 corner overlay,
  // cross-fade the socials clip in, and fade Eb1ke + the headline up behind it.
  var lastPb = -1;
  function dock(pb) {
    if (pb === lastPb) return;                 // gate: skip when the dock hasn't moved
    lastPb = pb;
    var e = smoother(pb);
    var vw = window.innerWidth, vh = window.innerHeight;
    var margin = Math.max(16, vw * 0.02);
    var endH = Math.max(210, Math.min(380, vh * 0.36));
    var endW = endH * 9 / 16;
    var w = lerp(vw, endW, e), h = lerp(vh, endH, e);
    var left = lerp(0, vw - endW - margin, e), top = lerp(0, vh - endH - margin, e);
    setRect(canvas, left, top, w, h);
    setRect(socials, left, top, w, h);
    canvas.classList.toggle("is-pip", pb > 0.02);

    if (socials) {
      var sv = clamp01((pb - 0.5) / 0.234);   // bike side-view -> socials cross-fade (30% slower)
      socials.style.opacity = sv.toFixed(3);
      if (sv > 0 && socials.paused) { var sp = socials.play(); if (sp && sp.catch) sp.catch(function () {}); }
    }
    if (pipLabel) {
      pipLabel.style.opacity = clamp01((pb - 0.52) / 0.195).toFixed(3);   // "Find us more" fade-in (30% slower)
      pipLabel.style.left = left + "px";
      pipLabel.style.top = (top - 32) + "px";
      pipLabel.style.width = w + "px";
    }
    var eb = clamp01((pb - 0.32) / 0.5);
    if (mainVideo) mainVideo.style.opacity = eb.toFixed(3);
    if (dim) dim.style.opacity = (eb * 0.6).toFixed(3);
    if (takeover) takeover.style.opacity = eb.toFixed(3);
    if (content) content.style.opacity = (1 - clamp01(pb / 0.3)).toFixed(3);
    if (overlay) overlay.style.opacity = (1 - clamp01(pb / 0.4)).toFixed(3);
  }

  function progress() {
    var scrollable = section.offsetHeight - window.innerHeight;
    var passed = -section.getBoundingClientRect().top;
    return clamp01(scrollable > 0 ? passed / scrollable : 0);
  }

  // Size the bike sequence as a share of total page scroll: the pinned track == rest/1.5, so
  // pin / (pin + rest) = 40% - lots of room for the scrub + a long Eb1ke hold. (rest = everything else.)
  function fitTrack() {
    var winH = window.innerHeight;
    var rest = document.documentElement.scrollHeight - section.offsetHeight;
    var baseTrack  = Math.max(winH, Math.round(winH + rest / 2)); // original animated track height
    var baseScroll = baseTrack - winH;                             // px of scroll the scrub+dock used
    var hold       = Math.max(0, Math.round(winH * HOLD_VH));      // extra pure-hold scroll after the dock
    section.style.height = (baseTrack + hold) + "px";

    // Keep the scrub + dock at the SAME pixel distance as before, then append `hold` px of pure
    // hold at the tail: once the bike has docked and "Socials" is showing, the user scrolls
    // through dead space before the kits section instead of dropping straight into it.
    var newScroll = baseScroll + hold;
    var k = newScroll > 0 ? baseScroll / newScroll : 1;
    kVal = k;
    HANDOFF   = tnum("handoff", HANDOFF_BASE) * k;
    DOCK_END  = tnum("dockEnd", DOCK_END_BASE) * k;
    SETTLE_TO = DOCK_END;
    COMMIT    = tnum("commit", 0.44) * k;   // pass-over threshold (gp >= COMMIT -> dock; else back to 0)
  }

  // ---- render straight from the (Lenis-eased) scroll position - NO second smoothing ----
  // Driven inside Lenis's own scroll callback, so it's frame-synced with the momentum (this is
  // what kills the slow/short-scroll jitter - the old separate rAF easing sampled scroll
  // between Lenis's updates). Falls back to an rAF-throttled native scroll listener with no
  // Lenis (reduced motion). Draws are gated, so a render call is cheap when nothing changed.
  function render() {
    var gp = progress();
    var pa = clamp01(gp / HANDOFF);
    var pb = clamp01((gp - HANDOFF) / (DOCK_END - HANDOFF));
    drawFrame(Math.round(pa * (FRAME_COUNT - 1)));
    paint(pa, pb);
    dock(pb);
    // live point for the tuning graph: x = scroll position (base fraction), y = bike progress
    var yProg = (gp <= HANDOFF) ? 0.5 * pa : (gp <= DOCK_END) ? 0.5 + 0.5 * smoother(pb) : 1;
    window.F1_PROG = { x: clamp01(kVal > 0 ? gp / kVal : gp), y: yProg, pastStart: gp >= backTarget() };
  }
  var rafPending = false;
  function requestRender() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () { rafPending = false; render(); });
  }

  // TEMP: let the tuning panel re-fit the track after changing the dock value.
  window.F1_TUNE_APPLY = function () { fitTrack(); render(); };

  // Scope the scroll feel to the hero. In the hero: the tuned long glide (lerp ~0.035). Past the
  // hero: a normal, comfortable everyday smooth-scroll (lerp ~0.1) - NOT instant (that felt snappy/
  // glitchy) and NOT lenis.stop() (that adds `lenis-stopped` -> overflow:hidden -> blank screen).
  // We also RAMP the lerp value frame-to-frame so the transition at the seam is seamless.
  var PAST_HERO_LERP = 0.14;   // past the hero: just a hint of glide, mostly tight/responsive
  var curLerp = tnum("lerp", 0.035);
  function setLenisLerp(v) {
    var L = window.lenis; if (!L) return;
    try { if (L.options) L.options.lerp = v; } catch (e) {}
    try { L.lerp = v; } catch (e) {}
  }
  function syncScrollMode() {
    if (!window.lenis) return;
    var pastHero = section.getBoundingClientRect().bottom <= window.innerHeight;
    var target = pastHero ? PAST_HERO_LERP : tnum("lerp", 0.035);
    // Only retune the lerp when the scroll ISN'T racing. Raising it mid-fast-scroll snaps the
    // accumulated Lenis lag closed -> that's the jump you feel leaving the dock. Waiting until the
    // scroll calms lets the gap shrink first, so the hero -> page transition stays smooth.
    if (Math.abs(window.lenis.velocity || 0) < 3) {
      curLerp += (target - curLerp) * 0.1;
      if (Math.abs(curLerp - target) < 0.003) curLerp = target;
      setLenisLerp(curLerp);
    }
  }

  function init() {
    sizeCanvas();
    fitTrack();
    render();
    if (window.lenis && typeof window.lenis.on === "function") {
      window.lenis.on("scroll", render);                 // frame-synced with the momentum engine (zero lag)
      window.lenis.on("scroll", maybeSettle);            // watch velocity each frame -> spring as the glide fades
      window.lenis.on("scroll", syncScrollMode);         // release to native scroll once past the hero
    }
    // Native-scroll backup: also fires while Lenis is stopped (past the hero), so we can re-engage
    // Lenis when you scroll back up into the hero. Gated draws keep it cheap.
    window.addEventListener("scroll", function () { requestRender(); syncScrollMode(); }, { passive: true });
    window.addEventListener("resize", syncScrollMode);
    syncScrollMode();
  }
  if (document.readyState === "complete") init();
  else window.addEventListener("load", init, { once: true });
  // Kick once now so the first frame paints ASAP even before full load.
  sizeCanvas(); fitTrack(); render();

  window.addEventListener("resize", function () { sizeCanvas(); fitTrack(); render(); }, { passive: true });

  // ============================================================
  // SLINGSHOT SNAP
  // When the user STOPS scrolling within the bike sequence we "settle" with a silky spring:
  //   • below the COMMIT point  -> spring the scroll back to the start (bike returns to its
  //     original front-on, full-screen frame).
  //   • at / past the COMMIT point -> spring forward so the bike auto-travels all the way to
  //     its docked bottom-right position with no more scrolling.
  // The spring animates window.scroll, which feeds the canvas loop, so the bike scrubs along
  // with it. Only fires on scroll-idle; any real wheel / touch / arrow input cancels it, so we
  // never fight the user. `committed` blocks repeat snapping until they scroll back to the top.
  // ============================================================
  var COMMIT, SETTLE_TO;   // both set in fitTrack() (scaled with the appended hold)
  var snapRAF = null, snapping = false, idleTimer = null, peakVel = 0;

  function gpToY(g) {
    var rect = section.getBoundingClientRect();
    var absTop = rect.top + window.scrollY;
    var scrollable = section.offsetHeight - window.innerHeight;
    return absTop + g * scrollable;
  }
  function cancelSnap() { snapping = false; if (snapRAF) cancelAnimationFrame(snapRAF); }
  function snapTo(targetGp, after) {
    var startY = window.scrollY, targetY = gpToY(targetGp), distY = targetY - startY;
    if (Math.abs(distY) < 2) { if (after) after(); return; }
    snapping = true;
    // Prefer Lenis so the spring shares the page's momentum easing; user input interrupts it.
    if (window.lenis && window.lenis.scrollTo) {
      window.lenis.scrollTo(targetY, {
        duration: Math.min(tnum("springMax", 1.22), Math.max(tnum("springMin", 0.854), Math.abs(distY) / 1875)),
        easing: easeOutSnap,
        onComplete: function () { snapping = false; if (after) after(); }
      });
      return;
    }
    var dur = Math.min(600, Math.max(360, Math.abs(distY) * 0.44));   // ms - scaled by distance (~0.4-0.6s burst, 20% faster)
    var t0 = null;
    if (snapRAF) cancelAnimationFrame(snapRAF);
    function step(now) {
      if (!t0) t0 = now;
      var p = clamp01((now - t0) / dur);
      window.scrollTo(0, startY + distY * easeOutSnap(p));            // quick spring-back ease (fallback)
      requestRender();                                                // canvas follows the spring
      if (p < 1 && snapping) { snapRAF = requestAnimationFrame(step); }
      else { snapping = false; if (after) after(); }
    }
    snapRAF = requestAnimationFrame(step);
  }
  // Settle to the nearest end based on the commit threshold - SYMMETRIC, so the same slingshot
  // fires whether you're scrolling DOWN into the sequence or back UP out of it:
  //   gp >= COMMIT -> spring forward to docked;  gp < COMMIT -> spring back to the start.
  // Instead of waiting for the glide to fully STOP, we watch the momentum and fire the spring the
  // instant it decays to a gentle drift (|velocity| <= SETTLE_VEL, i.e. it's *about* to stop). The
  // easeOut spring takes over from there, so the scroll never actually comes to rest - the dying
  // glide flows straight into the spring-back. A short input gate keeps it from taking over while
  // you're still actively scrolling.
  var settleTimer = null;
  function clearSettle() { if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; } }
  // Back-spring "start" target (gp): a % through the bike scrub (0 = front-on, 100 = side profile at
  // HANDOFF). This doubles as the FLOOR of the slingshot: anywhere from the actual top down to here
  // is free scroll - no spring. The slingshot only acts between this point and the dock.
  function backTarget() {
    var sp = tnum("startPct", 39);
    return (sp < 0 ? 0 : sp > 100 ? 100 : sp) / 100 * HANDOFF;
  }
  function doSnap() {
    settleTimer = null;
    if (snapping) return;
    var gp = progress();
    var bg = backTarget();
    // Free zone: below the start point (down to the actual top) gets no spring; the dock end is
    // parked. Only between the start point and the dock does the slingshot fire.
    if (gp <= Math.max(bg, 0.004) || gp >= SETTLE_TO) { window.F1_PEAK = peakVel; peakVel = 0; return; }
    var need = tnum("intensity", 0);
    var goFwd = gp >= COMMIT && (peakVel >= need || gp >= HANDOFF * 0.97);
    window.F1_PEAK = peakVel;                                        // expose last-gesture peak for the tuning panel
    peakVel = 0;
    snapTo(goFwd ? SETTLE_TO : bg);                                  // forward to dock, or back down to the start point
  }
  // Each scroll frame: once the drift slows past SETTLE_VEL ("about to stop"), arm a countdown and
  // fire the spring `inputGate` ms later (the Settle delay). Higher = a longer beat before it
  // springs (it coasts/sits first); 0 = it springs the instant the glide fades. Fresh input cancels.
  function maybeSettle() {
    if (snapping) return;
    var gp = progress();
    if (gp <= Math.max(backTarget(), 0.004) || gp >= SETTLE_TO) { clearSettle(); return; }   // free below the start point, parked at the dock
    var v = window.lenis ? Math.abs(window.lenis.velocity || 0) : 0;
    if (v > peakVel) peakVel = v;                                    // track this gesture's peak speed (scroll intensity)
    if (v > tnum("settleVel", 0.4)) { clearSettle(); return; }       // still gliding - not about to stop yet
    if (settleTimer == null) settleTimer = setTimeout(doSnap, Math.max(0, tnum("inputGate", 20)));
  }
  function onInput() { clearSettle(); if (snapping) cancelSnap(); }
  window.addEventListener("scroll", function () {
    if (snapping) return;
    maybeSettle();                                                   // every scroll frame - watches for the drift to fade
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(maybeSettle, 180);                       // backstop if the glide ends between scroll events
  }, { passive: true });
  window.addEventListener("wheel",      onInput, { passive: true });
  window.addEventListener("touchstart", onInput, { passive: true });
  window.addEventListener("touchmove",  onInput, { passive: true });
  window.addEventListener("keydown",    function (e) { if (/^(Arrow|Page|Home|End| )/.test(e.key)) onInput(); });

  // Keep Eb1ke playing from load so it's mid-playback the instant it fades in.
  if (mainVideo) { var mp = mainVideo.play(); if (mp && mp.catch) mp.catch(function () {}); }
})();

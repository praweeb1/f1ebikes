/* ============================================================
   F1 Ebikes - TEMPORARY scroll/spring tuning panel
   A small floating control to dial in the hero scroll feel live. Tweak the sliders, find what
   you like, then tell Claude the values shown in "Copy values" - and this whole file (plus the
   window.F1_TUNE hooks in hero-bg-sync.js / lenis-init.js) gets removed.
   To delete: remove this <script>, the F1_TUNE/tnum hooks, and F1_TUNE_APPLY.
   ============================================================ */
(function () {
  // Defaults MUST be set synchronously (before lenis-init.js / hero-bg-sync.js read them).
  var T = (window.F1_TUNE = window.F1_TUNE || {});
  var DEFAULTS = {
    lerp: 0.035,      // scroll glide smoothness (lower = longer, silkier glide)
    settleVel: 0.4,   // spring fires when the drift slows past this ("about to stop")
    springDur: 1.22,  // spring-back duration ceiling, seconds (floor is 70% of this)
    inputGate: 20,    // ms after the drift fades before the spring fires (Settle delay)
    startPct: 39,     // back-spring 'start' target, as a % through the bike scrub (0 = front-on)
    commit: 0.44,     // scrub fraction you must pass to commit forward (else springs back to start)
    handoff: 0.67,    // where the scrub ends and the dock begins
    dockEnd: 0.9,     // fully-docked point / forward spring target (higher = slower dock)
    intensity: 0      // scroll-intensity gate DISABLED (0 = off)
  };
  for (var k in DEFAULTS) if (T[k] == null) T[k] = DEFAULTS[k];
  syncDerived();

  function syncDerived() {            // springDur drives both the max and a 70% min
    T.springMax = T.springDur;
    T.springMin = +(T.springDur * 0.7).toFixed(3);
  }
  function applyLerp() {
    if (!window.lenis) return;
    try { window.lenis.options && (window.lenis.options.lerp = T.lerp); } catch (e) {}
    try { window.lenis.lerp = T.lerp; } catch (e) {}
  }

  var ROWS = [
    { key: "lerp",      label: "Glide smoothness", min: 0.02, max: 0.18, step: 0.005, hint: "lower = longer glide" },
    { key: "settleVel", label: "Spring trigger",   min: 0.05, max: 0.7,  step: 0.01,  hint: "higher = springs earlier" },
    { key: "springDur", label: "Spring speed",     min: 0.08, max: 3.0,  step: 0.02,  hint: "lower = faster spring (higher = slower)" },
    { key: "inputGate", label: "Settle delay",     min: 0,    max: 350,  step: 10,    hint: "ms before it springs" },
    { key: "startPct",  label: "Start point",      min: 0,    max: 100,  step: 1,     hint: "% through the scrub the back-spring lands (0 = front-on)" },
    { key: "commit",    label: "Commit point",     min: 0.10, max: 0.95, step: 0.01,  hint: "pass this to dock; below it springs back to start" },
    { key: "handoff",   label: "Handoff point",    min: 0.30, max: 0.98, step: 0.01,  hint: "where the scrub ends / dock begins" },
    { key: "dockEnd",   label: "Dock end",         min: 0.70, max: 0.98, step: 0.005, hint: "fully-docked target (higher = slower dock)" },
    { key: "intensity", label: "Scroll intensity", min: 0,    max: 140,  step: 1,     hint: "0 = off; single notch peaks ~4, hard scroll ~70" }
  ];

  function build() {
    if (document.getElementById("f1-tune")) return;
    var box = document.createElement("div");
    box.id = "f1-tune";
    box.innerHTML =
      '<style>' +
      '#f1-tune{position:fixed;left:14px;bottom:14px;z-index:99999;width:248px;padding:12px 13px 11px;' +
      'background:rgba(16,16,18,.92);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.14);' +
      'border-radius:12px;color:#fff;font:500 12px/1.3 Archivo,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);}' +
      '#f1-tune h4{margin:0 0 9px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#e02b1e;' +
      'display:flex;justify-content:space-between;align-items:center;}' +
      '#f1-tune .row{margin:0 0 9px;}' +
      '#f1-tune .lab{display:flex;justify-content:space-between;margin:0 0 3px;}' +
      '#f1-tune .lab b{font-weight:700;}#f1-tune .lab span{color:#9aff;color:rgba(255,255,255,.55);}' +
      '#f1-tune .val{color:#fff;font-variant-numeric:tabular-nums;}' +
      '#f1-tune input[type=range]{width:100%;accent-color:#e02b1e;height:16px;margin:0;cursor:pointer;}' +
      '#f1-tune .btns{display:flex;gap:6px;margin-top:4px;}' +
      '#f1-tune button{flex:1;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;' +
      'border-radius:7px;padding:6px 4px;font:600 11px Archivo,sans-serif;cursor:pointer;}' +
      '#f1-tune button:hover{background:rgba(255,255,255,.14);}' +
      '#f1-tune button.prim{background:#e02b1e;border-color:#e02b1e;}' +
      '#f1-tune .out{width:100%;margin-top:7px;height:54px;display:none;resize:none;background:#0c0c0d;color:#9fef;' +
      'color:#a7f3a7;border:1px solid rgba(255,255,255,.14);border-radius:7px;font:500 10px/1.35 monospace;padding:6px;}' +
      '#f1-tune .min{cursor:pointer;border:0;background:none;color:rgba(255,255,255,.6);padding:0;font-size:14px;flex:0;}' +
      '#f1-tune .meter{font:600 10px/1.4 monospace;color:#a7f3a7;margin:1px 0 8px;letter-spacing:.02em;}' +
      '#f1-tune.is-min .row,#f1-tune.is-min .btns,#f1-tune.is-min .out,#f1-tune.is-min .meter{display:none;}' +
      '</style>' +
      '<h4>Scroll tuning <button class="min" id="f1-min" title="collapse">–</button></h4>' +
      '<div class="meter" id="f1-meter">vel 0.00 · last-scroll peak 0.00</div>' +
      '<div id="f1-rows"></div>' +
      '<div class="btns"><button class="prim" id="f1-copy">Copy values</button>' +
      '<button id="f1-reset">Reset</button></div>' +
      '<textarea class="out" id="f1-out" readonly></textarea>';
    document.body.appendChild(box);

    var rowsEl = box.querySelector("#f1-rows");
    ROWS.forEach(function (r) {
      var row = document.createElement("div");
      row.className = "row";
      row.innerHTML =
        '<div class="lab"><b>' + r.label + '</b><span class="val" data-v="' + r.key + '"></span></div>' +
        '<input type="range" min="' + r.min + '" max="' + r.max + '" step="' + r.step + '" data-k="' + r.key + '">' +
        '<div class="lab"><span>' + r.hint + '</span></div>';
      rowsEl.appendChild(row);
      var slider = row.querySelector("input");
      slider.value = T[r.key];
      row.querySelector(".val").textContent = T[r.key];
      slider.addEventListener("input", function () {
        T[r.key] = parseFloat(slider.value);
        row.querySelector(".val").textContent = slider.value;
        if (r.key === "springDur") syncDerived();
        if (r.key === "lerp") applyLerp();
        if ((r.key === "dockEnd" || r.key === "commit" || r.key === "handoff") && window.F1_TUNE_APPLY) window.F1_TUNE_APPLY();
      });
    });

    box.querySelector("#f1-min").addEventListener("click", function () { box.classList.toggle("is-min"); });
    box.querySelector("#f1-reset").addEventListener("click", function () {
      for (var key in DEFAULTS) T[key] = DEFAULTS[key];
      syncDerived(); applyLerp(); if (window.F1_TUNE_APPLY) window.F1_TUNE_APPLY();
      box.querySelectorAll("input[type=range]").forEach(function (s) {
        s.value = T[s.dataset.k]; box.querySelector('[data-v="' + s.dataset.k + '"]').textContent = T[s.dataset.k];
      });
    });
    box.querySelector("#f1-copy").addEventListener("click", function () {
      var txt =
        "lerp=" + T.lerp +
        "  settleVel=" + T.settleVel +
        "  springDur=" + T.springDur +
        "  inputGate=" + T.inputGate +
        "  startPct=" + T.startPct +
        "  commit=" + T.commit +
        "  handoff=" + T.handoff +
        "  dockEnd=" + T.dockEnd +
        "  intensity=" + T.intensity;
      var out = box.querySelector("#f1-out");
      out.style.display = "block"; out.value = txt;
      try { navigator.clipboard.writeText(txt); } catch (e) {}
      console.log("[F1 tuning] " + txt);
    });

    applyLerp();

    // Live meter: current scroll speed + the peak of your last scroll - use it to pick "Scroll
    // intensity" (set it between a gentle scroll's peak and a hard scroll's peak).
    var meter = box.querySelector("#f1-meter");
    (function tick() {
      if (meter) {
        var v = (window.lenis && Math.abs(window.lenis.velocity || 0)) || 0;
        var pk = +(window.F1_PEAK || 0);
        meter.textContent = "vel " + v.toFixed(2) + " · last-scroll peak " + pk.toFixed(2);
      }
      requestAnimationFrame(tick);
    })();
  }

  // ---- Second overlay: a static graph of scroll distance (X) -> bike progress (Y) ----
  // Y: 0 = front-on start, 0.5 = handoff (scrub done), 1 = fully docked. Markers for Start (S),
  // Commit (C), Handoff (H), Dock (D). Plotted in base-fraction space (the page-scale k cancels),
  // so it shows exactly what your sliders shape and redraws whenever you move one.
  function buildGraph() {
    if (document.getElementById("f1-graph")) return;
    var W = 250;
    var box = document.createElement("div");
    box.id = "f1-graph";
    box.innerHTML =
      '<style>' +
      '#f1-graph{position:fixed;left:14px;top:14px;z-index:99999;width:' + W + 'px;padding:9px 10px 7px;' +
      'background:rgba(16,16,18,.92);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.14);' +
      'border-radius:12px;color:#fff;font:600 11px/1.2 Archivo,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);}' +
      '#f1-graph h4{margin:0 0 6px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#e02b1e;}' +
      '#f1-graph canvas{display:block;}' +
      '#f1-graph .leg{margin-top:5px;font:700 9px Archivo,sans-serif;color:rgba(255,255,255,.6);display:flex;gap:9px;flex-wrap:wrap;}' +
      '</style>' +
      '<h4>Scroll &rarr; bike progress</h4>' +
      '<canvas id="f1-gcanvas"></canvas>' +
      '<div class="leg"><span style="color:#5aa9ff">S start</span><span style="color:#e02b1e">C commit</span><span style="color:#ffd24a">H handoff</span><span style="color:#46d17a">D dock</span></div>';
    document.body.appendChild(box);
    var canvas = box.querySelector("#f1-gcanvas");

    var sstep = F1.smootherstep;   // smootherstep (matches the dock easing)
    function num(v, d) { return (typeof v === "number" && !isNaN(v)) ? v : d; }

    function draw() {
      var Tn = window.F1_TUNE || {};
      var ho = num(Tn.handoff, 0.62), de = num(Tn.dockEnd, 0.9), cm = num(Tn.commit, 0.42);
      var sb = (num(Tn.startPct, 0) / 100) * ho;   // start point in base-fraction space (% of scrub)
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var cw = W - 20, ch = 150;
      canvas.width = cw * dpr; canvas.height = ch * dpr;
      canvas.style.width = cw + "px"; canvas.style.height = ch + "px";
      var ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      var L = 30, R = 8, Tp = 10, B = 18, pw = cw - L - R, ph = ch - Tp - B;
      function X(x) { return L + (x < 0 ? 0 : x > 1 ? 1 : x) * pw; }
      function Y(y) { return Tp + (1 - y) * ph; }
      // free-scroll zone [0, start]
      ctx.fillStyle = "rgba(90,169,255,.10)";
      ctx.fillRect(X(0), Tp, X(sb) - X(0), ph);
      // axes + handoff gridline (y = 0.5)
      ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L, Tp); ctx.lineTo(L, Tp + ph); ctx.lineTo(L + pw, Tp + ph); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.08)";
      ctx.beginPath(); ctx.moveTo(L, Y(0.5)); ctx.lineTo(L + pw, Y(0.5)); ctx.stroke();
      // curve: linear scrub 0->0.5, then eased dock 0.5->1, then flat (docked hold)
      function prog(x) {
        if (x <= 0) return 0;
        if (x < ho) return ho > 0 ? 0.5 * (x / ho) : 0;
        if (x < de) { var pb = (de - ho) > 0 ? (x - ho) / (de - ho) : 1; return 0.5 + 0.5 * sstep(pb); }
        return 1;
      }
      ctx.strokeStyle = "#e02b1e"; ctx.lineWidth = 2; ctx.beginPath();
      for (var i = 0; i <= 120; i++) { var x = i / 120, px = X(x), py = Y(prog(x)); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
      // threshold markers
      function mark(x, color, label) {
        ctx.strokeStyle = color; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(X(x), Tp); ctx.lineTo(X(x), Tp + ph); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = color; ctx.font = "800 9px Archivo,sans-serif"; ctx.fillText(label, X(x) - 3, Tp + 8);
      }
      mark(sb, "#5aa9ff", "S"); mark(cm, "#e02b1e", "C"); mark(ho, "#ffd24a", "H"); mark(de, "#46d17a", "D");
      // labels
      ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.font = "600 8px Archivo,sans-serif";
      ctx.fillText("dock", 3, Y(1) + 3); ctx.fillText("start", 3, Y(0) + 1);
      ctx.fillText("scroll distance →", L, ch - 5);
      // live position dot: where the bike is right now (current scroll -> current progress)
      var P = window.F1_PROG;
      if (P && typeof P.x === "number") {
        ctx.beginPath(); ctx.arc(X(P.x), Y(P.y), 4.5, 0, Math.PI * 2);
        ctx.fillStyle = "#fff"; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = "#e02b1e"; ctx.stroke();
      }
    }

    var sig = "";
    (function tick() {
      var Tn = window.F1_TUNE || {}, P = window.F1_PROG;
      // redraw when a slider changes OR the live dot moves (round so an idle dot doesn't redraw)
      var s = [Tn.startPct, Tn.commit, Tn.handoff, Tn.dockEnd, P && Math.round(P.x * 600), P && Math.round(P.y * 600)].join(",");
      if (s !== sig) { sig = s; draw(); }
      requestAnimationFrame(tick);
    })();
  }

  // Type "jason" anywhere to toggle the bike-progress graph. The slider panel (#f1-tune)
  // stays DISABLED - jason never shows it; only the graph comes and goes.
  function setupHotkey() {
    var buf = "", hidden = true;
    function apply() {
      var tune = document.getElementById("f1-tune");
      if (tune) tune.style.display = "none";             // slider overlay disabled for the hotkey
      var graph = document.getElementById("f1-graph");
      if (graph) graph.style.display = hidden ? "none" : "";
    }
    apply();                                               // hidden from the start
    document.addEventListener("keydown", function (e) {
      if (!e.key || e.key.length !== 1) return;            // only single character keys
      buf = (buf + e.key.toLowerCase()).slice(-5);
      if (buf === "jason") { buf = ""; hidden = !hidden; apply(); }
    });
  }

  function startUI() { build(); buildGraph(); setupHotkey(); }
  if (document.body) startUI();
  else document.addEventListener("DOMContentLoaded", startUI, { once: true });
})();

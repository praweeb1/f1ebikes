/* ============================================================
   F1 Ebikes - Hero digital decode (typing) effect
   Types the two homepage videosec headlines character-by-character:
   the next few characters flicker through random glyphs (accent red)
   before locking into place as white text, with a blinking caret.
   No dependencies. Respects reduced motion (final text instantly).
   Each headline fires at its own reveal moment:
     - "Built to perform."            -> after the battery loader
                                         dissolves (desktop content block;
                                         the block is display:none on mobile).
     - "A new era of / riding starts here."
                                      -> desktop: when the Eb1ke takeover
                                         fades in (container opacity crosses
                                         a threshold); mobile/lite: when it
                                         scrolls into view.
   ============================================================ */
(function () {
  var reduce =
    (window.F1 && typeof F1.reducedMotion === "function" && F1.reducedMotion()) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Same lite/mobile detection hero-loader.js and hero-bg-sync.js use, so the
  // "which headline shows where" logic stays in sync with the hero.
  var isIOS = /iP(hone|ad|od)/i.test(navigator.userAgent) ||
              (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var lite = window.matchMedia("(max-width: 860px)").matches || isIOS;

  var CHAR_MS  = 46;   // per-character lock-in cadence
  var TICK_MS  = 34;   // scramble re-randomize rate
  var AHEAD    = 3;    // upcoming chars that flicker before locking
  var START_MS = 140;  // a small beat before the first key
  var GLYPHS   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$+*<>/=";

  // Split an element's text + <br> children into an ordered token list
  // ("\n" marks a line break) plus the full accessible string.
  function parse(el) {
    var tokens = [], full = "";
    [].forEach.call(el.childNodes, function (n) {
      if (n.nodeType === 3) {
        var t = n.nodeValue;
        for (var i = 0; i < t.length; i++) tokens.push(t[i]);
        full += t;
      } else if (n.nodeType === 1 && n.tagName === "BR") {
        tokens.push("\n");
        full += " ";
      }
    });
    return { tokens: tokens, full: full.replace(/\s+/g, " ").trim() };
  }

  // Blank the element and give it a locked-text target (.vt), a scramble
  // window (.vt-scr) and a caret. All inline, so the scramble + caret flow
  // right after the last locked character (even across a <br>).
  function build(el, data) {
    el.setAttribute("aria-label", data.full);   // SR reads the whole line up front
    el.textContent = "";
    var vt = document.createElement("span");
    vt.className = "vt";
    vt.setAttribute("aria-hidden", "true");
    var scr = document.createElement("span");
    scr.className = "vt-scr";
    scr.setAttribute("aria-hidden", "true");
    var caret = document.createElement("span");
    caret.className = "vt-caret";
    caret.setAttribute("aria-hidden", "true");
    el.appendChild(vt);
    el.appendChild(scr);
    el.appendChild(caret);
    return { vt: vt, scr: scr, caret: caret };
  }

  // Render every token at once (final / reduced-motion state).
  function fill(vt, tokens) {
    var line = null;
    tokens.forEach(function (tk) {
      if (tk === "\n") { vt.appendChild(document.createElement("br")); line = null; }
      else {
        if (!line) { line = document.createTextNode(""); vt.appendChild(line); }
        line.nodeValue += tk;
      }
    });
  }

  // Lock the element's height to its finished size so the bottom-anchored
  // takeover title doesn't jump when the second line is typed in.
  function reserve(el, vt, tokens) {
    fill(vt, tokens);
    var h = el.getBoundingClientRect().height;
    if (h) el.style.minHeight = Math.ceil(h) + "px";
    vt.textContent = "";
  }

  function type(nodes, tokens) {
    var vt = nodes.vt, scr = nodes.scr, caret = nodes.caret;
    var locked = 0, line = null, acc = 0, timer = 0;
    caret.classList.add("is-live");

    function lockOne() {
      var tk = tokens[locked++];
      if (tk === "\n") { vt.appendChild(document.createElement("br")); line = null; }
      else {
        if (!line) { line = document.createTextNode(""); vt.appendChild(line); }
        line.nodeValue += tk;
      }
    }
    // Random glyphs for the next few characters. Spaces stay spaces (no word-wrap
    // jitter) and the window never crosses a line break.
    function scramble() {
      var out = "";
      for (var j = locked, seen = 0; j < tokens.length && seen < AHEAD; j++) {
        var tk = tokens[j];
        if (tk === "\n") break;
        if (tk === " ") { out += " "; continue; }
        out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
        seen++;
      }
      return out;
    }
    function tick() {
      acc += TICK_MS;
      while (acc >= CHAR_MS && locked < tokens.length) { acc -= CHAR_MS; lockOne(); }
      if (locked >= tokens.length) {
        clearInterval(timer);
        scr.textContent = "";
        caret.classList.remove("is-live");
        caret.classList.add("is-done");   // hold a beat, then fade the caret out
        return;
      }
      scr.textContent = scramble();
    }
    setTimeout(function () { timer = setInterval(tick, TICK_MS); }, START_MS);
  }

  // Wire one headline: blank it, reserve its height (after fonts load so the
  // measurement is right), then fire `type` when `trigger` says the moment is now.
  function setup(el, trigger) {
    if (!el) return;
    var data = parse(el);
    if (!data.tokens.length) return;
    var nodes = build(el, data);

    if (reduce) { fill(nodes.vt, data.tokens); nodes.scr.remove(); nodes.caret.remove(); return; }

    function ready() {
      reserve(el, nodes.vt, data.tokens);
      trigger(function () { type(nodes, data.tokens); });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ready);
    else ready();
  }

  // Trigger: after the battery loader dissolves (html.batt-locked removed).
  function onHeroReady(start) {
    var root = document.documentElement;
    if (!root.classList.contains("batt-locked")) { start(); return; }  // no loader (mobile/reduced)
    var fs = setTimeout(function () { mo.disconnect(); start(); }, 17000);
    var mo = new MutationObserver(function () {
      if (!root.classList.contains("batt-locked")) { mo.disconnect(); clearTimeout(fs); start(); }
    });
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
  }

  // Trigger: desktop takeover fades in (container inline opacity crosses a threshold).
  function onTakeoverFade(container, start) {
    var fired = false;
    function check() {
      if (fired) return;
      var o = parseFloat(container.style.opacity || getComputedStyle(container).opacity || "0");
      if (o >= 0.1) { fired = true; mo.disconnect(); start(); }
    }
    var mo = new MutationObserver(check);
    mo.observe(container, { attributes: true, attributeFilter: ["style"] });
    check();
  }

  // Trigger: element scrolls into view (mobile/lite takeover, which is always opaque).
  function onInView(el, start) {
    if (!("IntersectionObserver" in window)) { start(); return; }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); start(); } });
    }, { threshold: 0.6 });
    io.observe(el);
  }

  var heading  = document.querySelector(".videosec__heading");
  var takeover = document.getElementById("videosec-takeover");
  var title    = takeover && takeover.querySelector(".videosec__takeover-title");

  // "Built to perform." lives in the desktop content block (hidden on mobile/lite).
  if (!lite) setup(heading, onHeroReady);

  // "A new era of / riding starts here."
  if (title) {
    setup(title, function (start) {
      if (lite) onInView(title, start);
      else onTakeoverFade(takeover, start);
    });
  }
})();

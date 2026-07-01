/* ============================================================
   F1 Ebikes — Reviews scroll portrait wall (shared)
   Vanilla port of the GSAP ScrollTrigger "ScrollPortraitWall". Customer build photos scatter across
   a grid; each scrubs scale 0 -> 1 -> 0 as it passes the viewport, behind a sticky mix-blend title.
   Page-agnostic: finds any `.spw` section. Captions toggled with data-captions; b&w via .spw--bw.
   ============================================================ */
(function () {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);

  var root = document.querySelector(".spw");
  if (!root) return;
  var grid = root.querySelector(".spw__grid");
  var hintEl = root.querySelector(".spw__hint");
  if (!grid) return;

  var showCaps = root.getAttribute("data-captions") !== "false";

  // Sync ScrollTrigger to Lenis smooth-scroll when present (homepage).
  if (window.lenis && typeof window.lenis.on === "function") {
    window.lenis.on("scroll", ScrollTrigger.update);
  }

  // Customer build photos + reviewer + the kit they run.
  var IMGS = ["IMG_3947", "IMG_3949", "IMG_3962", "IMG_3960", "IMG_3952", "IMG_3963",
              "IMG_3954", "IMG_3948", "IMG_3950", "IMG_3951", "IMG_3958", "IMG_3959"];
  var NAMES = ["Lachlan Mitchell", "Cooper S.", "Hamish Thompson", "Beau R.", "Jett Kavanagh", "Darcy D.",
               "Bailey Paterson", "Angus L.", "Brodie Williams", "Riley T.", "Mason C.", "Flynn O."];
  var ROLES = ["2000W Kit", "5000W Kit", "3000W Kit", "2000W Kit", "3000W Kit", "1500W Kit",
               "5000W Kit", "2000W Kit", "3000W Kit", "2000W Kit", "5000W Kit", "3000W Kit"];
  var reviews = IMGS.map(function (n, i) {
    return { src: "Images/Customer%20Pics/" + n + ".jpg", name: NAMES[i], role: ROLES[i] };
  });

  // Deterministic scatter: one portrait per row, every 3rd row holds a second.
  function buildLayout(count, cols) {
    var rows = [], i = 0, r = 0;
    while (i < count) {
      var row = new Array(cols).fill(-1);
      var a = (r * 2 + (r % 2)) % cols;
      row[a] = i++;
      if (r % 3 === 0 && i < count) {
        var b = (a + 2) % cols;
        if (b === a) b = (a + 1) % cols;
        row[b] = i++;
      }
      rows.push(row);
      r++;
    }
    return rows;
  }

  var DESIRED = 4;
  function currentCols() {
    if (window.matchMedia("(min-width: 1024px)").matches) return DESIRED;
    if (window.matchMedia("(min-width: 640px)").matches) return Math.min(DESIRED, 3);
    return Math.min(DESIRED, 2);
  }

  var ctx = null, builtCols = -1;

  function render() {
    var cols = currentCols();
    if (cols === builtCols) return;          // only rebuild when the column count changes
    builtCols = cols;
    if (ctx) { ctx.revert(); ctx = null; }

    var layout = buildLayout(reviews.length, cols);
    var html = "";
    layout.forEach(function (row) {
      html += '<div class="spw__row">';
      row.forEach(function (idx, ci) {
        if (idx === -1) { html += '<div class="spw__cell"></div>'; return; }
        var s = reviews[idx];
        var origin = ci < cols / 2 ? "right bottom" : "left bottom";
        html +=
          '<div class="spw__cell"><div class="spw-item" style="transform-origin:' + origin + '">' +
          '<img src="' + s.src + '" alt="' + s.name + '" loading="lazy" decoding="async" draggable="false" />' +
          (showCaps ? '<div class="spw-item__cap"><span>' + s.name + '</span><span>(' + s.role + ')</span></div>' : '') +
          '</div></div>';
      });
      html += "</div>";
    });
    grid.innerHTML = html;

    var items = grid.querySelectorAll(".spw-item");
    if (F1.reducedMotion()) {
      items.forEach(function (el) { el.style.transform = "scale(1)"; });
      return;
    }

    ctx = gsap.context(function () {
      if (hintEl) {
        // Stays visible while "Riders." is centred, then fades as the first portraits scale in.
        gsap.fromTo(hintEl,
          { autoAlpha: 1 },
          {
            autoAlpha: 0, ease: "none", immediateRender: false,
            scrollTrigger: { trigger: root, start: "top top", end: "+=35%", scrub: true }
          });
      }
      // each portrait grows in from its corner, peaks at centre, shrinks away
      items.forEach(function (el) {
        gsap.timeline({ scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } })
          .fromTo(el, { scale: 0 }, { scale: 1, ease: "power2.out", duration: 0.5 })
          .to(el, { scale: 0, ease: "power2.in", duration: 0.5 });
      });
    }, root);
  }

  render();
  // Recompute positions once everything (incl. the hero's dynamic height) has laid out.
  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  setTimeout(function () { ScrollTrigger.refresh(); }, 600);

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { render(); ScrollTrigger.refresh(); }, 150);
  });
})();

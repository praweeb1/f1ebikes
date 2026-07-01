/* ============================================================
   F1 Ebikes — collection shop controls
   Client-side category filter + price sort + wishlist toggle for the
   product grid. Pure DOM, no dependencies. Respects the original
   ("Featured") order and keeps the visible product count in sync.
   ============================================================ */
(function () {
  var grid = document.getElementById("collection-grid");
  if (!grid) return;

  var cards   = [].slice.call(grid.querySelectorAll(".prod"));
  var order   = cards.slice();                       // original "Featured" order

  // Availability badge on every card (covers both pages). The 2000W kit is low stock —
  // red dot + "Only 3 left"; everything else gets a green dot + "In stock".
  cards.forEach(function (card) {
    var body = card.querySelector(".prod__body");
    if (!body || body.querySelector(".prod__stock")) return;
    var link = card.querySelector(".prod__link") || card.querySelector(".prod__name");
    var href = link ? (link.getAttribute("href") || "") : "";
    var low = /2000w-ebike-kit-with-battery/i.test(href);
    var s = document.createElement("p");
    s.className = "prod__stock" + (low ? " prod__stock--low" : "");
    s.innerHTML = '<span class="prod__stock-dot" aria-hidden="true"></span>' + (low ? "Only 3 left" : "In stock");
    body.appendChild(s);
  });
  var filters = [].slice.call(document.querySelectorAll(".cfilter"));
  var sortSel = document.getElementById("collection-sort");
  var countEl = document.getElementById("collection-count");
  var emptyEl = document.getElementById("collection-empty");

  var current = "all";

  function priceOf(card) { return parseFloat(card.getAttribute("data-price")) || 0; }

  function apply() {
    // sort the working list
    var list = order.slice();
    var mode = sortSel ? sortSel.value : "featured";
    if (mode === "price-asc") list.sort(function (a, b) { return priceOf(a) - priceOf(b); });
    else if (mode === "price-desc") list.sort(function (a, b) { return priceOf(b) - priceOf(a); });

    // re-append in the chosen order (keeps the DOM matching the sort)
    list.forEach(function (card) { grid.appendChild(card); });

    // filter by category + count what's visible
    var shown = 0;
    list.forEach(function (card) {
      var match = current === "all" || card.getAttribute("data-cat") === current;
      card.hidden = !match;
      if (match) shown++;
    });

    if (countEl) countEl.textContent = shown;
    if (emptyEl) emptyEl.hidden = shown !== 0;
  }

  filters.forEach(function (btn) {
    btn.addEventListener("click", function () {
      current = btn.getAttribute("data-filter");
      filters.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      apply();
    });
  });

  if (sortSel) sortSel.addEventListener("change", apply);

  // wishlist toggle (visual / local only)
  grid.addEventListener("click", function (e) {
    var btn = e.target.closest(".prod__wish");
    if (!btn) return;
    e.preventDefault();
    var on = btn.getAttribute("aria-pressed") === "true";
    btn.setAttribute("aria-pressed", on ? "false" : "true");
    btn.classList.toggle("is-saved", !on);
  });

  apply();

  // "open into collection" — cascade the section in when it scrolls up as the hero ends.
  var section = document.getElementById("collection");
  if (section && "IntersectionObserver" in window &&
      !F1.reducedMotion()) {
    section.classList.add("js-reveal");
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { section.classList.add("is-open"); io.disconnect(); }
    }, { threshold: 0.08 });
    io.observe(section);
  }
})();

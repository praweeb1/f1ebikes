/* ============================================================
   F1 Ebikes — client-side cart (no backend, no dependencies)
   Self-contained: injects a slide-out drawer, wires the nav cart icons, and
   intercepts the ".prod__add" (Add to cart) buttons on every product page.
   State lives in localStorage so the cart follows the visitor across pages.
   "Checkout" hands off to the real Shopify store (true per-variant checkout
   would need Shopify variant IDs, which the static markup doesn't carry).
   ============================================================ */
(function () {
  var KEY = "f1_cart_v1";
  var STORE = "https://f1ebikes.com"; // checkout handoff target

  function read() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function write() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} }
  var items = read();

  function money(n) { return "$" + (Math.round(n * 100) / 100).toFixed(2); }
  function count() { return items.reduce(function (s, it) { return s + it.qty; }, 0); }
  function subtotal() { return items.reduce(function (s, it) { return s + it.price * it.qty; }, 0); }

  // ---- reading a product card ----
  function parsePrice(prod) {
    var dp = prod.getAttribute("data-price");
    if (dp && !isNaN(parseFloat(dp))) return parseFloat(dp);
    var el = prod.querySelector(".prod__now");           // fallback: "From $410.00"
    if (el) { var m = el.textContent.replace(/[^0-9.]/g, ""); if (m) return parseFloat(m); }
    return 0;
  }
  function addFromCard(prod) {
    var nameEl = prod.querySelector(".prod__name");
    var linkEl = prod.querySelector(".prod__link, .prod__name, .prod__add");
    var imgEl = prod.querySelector(".prod__media img, img");
    var name = nameEl ? nameEl.textContent.trim() : "Item";
    var url = linkEl ? (linkEl.getAttribute("href") || STORE) : STORE;
    var id = (url && url.indexOf("http") === 0) ? url : name;
    var img = imgEl ? imgEl.getAttribute("src") : "";
    var price = parsePrice(prod);
    var existing = null;
    for (var i = 0; i < items.length; i++) if (items[i].id === id) { existing = items[i]; break; }
    if (existing) existing.qty += 1;
    else items.push({ id: id, name: name, price: price, img: img, url: url, qty: 1 });
    write(); render(); open();
  }
  function find(id) { for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i]; return null; }
  function setQty(id, delta) {
    var it = find(id); if (!it) return;
    it.qty += delta;
    if (it.qty <= 0) items = items.filter(function (x) { return x.id !== id; });
    write(); render();
  }
  function removeItem(id) { items = items.filter(function (x) { return x.id !== id; }); write(); render(); }

  // ---- DOM ----
  var overlay, drawer, listEl, subEl, badgeEls = [];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function buildDOM() {
    overlay = document.createElement("div");
    overlay.className = "cart-overlay";
    drawer = document.createElement("aside");
    drawer.className = "cart-drawer";
    drawer.setAttribute("aria-hidden", "true");
    drawer.setAttribute("aria-label", "Shopping cart");
    drawer.innerHTML =
      '<div class="cart-drawer__head">' +
        '<h3 class="cart-drawer__title">Your cart <span class="cart-drawer__count" id="cart-hcount">0</span></h3>' +
        '<button class="cart-drawer__close" type="button" aria-label="Close cart">&times;</button>' +
      '</div>' +
      '<div class="cart-drawer__list"></div>' +
      '<div class="cart-drawer__foot">' +
        '<div class="cart-drawer__sub"><span>Subtotal</span><span id="cart-sub">$0.00</span></div>' +
        '<p class="cart-drawer__note">Shipping &amp; taxes calculated at checkout.</p>' +
        '<a class="cart-drawer__checkout" href="' + STORE + '" target="_blank" rel="noopener">Checkout</a>' +
        '<button class="cart-drawer__cont" type="button">Continue shopping</button>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    listEl = drawer.querySelector(".cart-drawer__list");
    subEl = drawer.querySelector("#cart-sub");

    overlay.addEventListener("click", close);
    drawer.querySelector(".cart-drawer__close").addEventListener("click", close);
    drawer.querySelector(".cart-drawer__cont").addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

    // qty +/- and remove (event delegation)
    listEl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      var row = b.closest(".cart-item"); if (!row) return;
      var id = decodeURIComponent(row.getAttribute("data-id"));
      var act = b.getAttribute("data-act");
      if (act === "inc") setQty(id, 1);
      else if (act === "dec") setQty(id, -1);
      else if (act === "rm") removeItem(id);
    });
  }

  function open() {
    drawer.classList.add("is-open"); overlay.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden";
  }
  function close() {
    drawer.classList.remove("is-open"); overlay.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true"); document.body.style.overflow = "";
  }

  function render() {
    var c = count();
    badgeEls.forEach(function (b) { b.textContent = c; b.style.display = c ? "" : "none"; });
    var hc = document.getElementById("cart-hcount"); if (hc) hc.textContent = c;

    if (!items.length) {
      listEl.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
    } else {
      listEl.innerHTML = items.map(function (it) {
        var did = encodeURIComponent(it.id);
        return '<div class="cart-item" data-id="' + did + '">' +
          (it.img ? '<img class="cart-item__img" src="' + esc(it.img) + '" alt="" loading="lazy" />'
                  : '<div class="cart-item__img"></div>') +
          '<div class="cart-item__body">' +
            '<div class="cart-item__name">' + esc(it.name) + '</div>' +
            '<div class="cart-item__price">' + money(it.price) + ' each</div>' +
            '<div class="cart-item__qty">' +
              '<button class="cart-qty__btn" type="button" data-act="dec" aria-label="Decrease quantity">&minus;</button>' +
              '<span class="cart-qty__n">' + it.qty + '</span>' +
              '<button class="cart-qty__btn" type="button" data-act="inc" aria-label="Increase quantity">+</button>' +
              '<button class="cart-item__rm" type="button" data-act="rm" aria-label="Remove item">Remove</button>' +
            '</div>' +
          '</div>' +
          '<div class="cart-item__line">' + money(it.price * it.qty) + '</div>' +
        '</div>';
      }).join("");
    }
    subEl.textContent = money(subtotal());
    var co = drawer.querySelector(".cart-drawer__checkout");
    if (co) { co.style.pointerEvents = items.length ? "" : "none"; co.style.opacity = items.length ? "" : ".45"; }
  }

  function wire() {
    // nav cart icons: open the drawer + attach a live count badge
    var icons = document.querySelectorAll('[aria-label="Cart"]');
    Array.prototype.forEach.call(icons, function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); render(); open(); });
      if (getComputedStyle(a).position === "static") a.style.position = "relative";
      var b = document.createElement("span");
      b.className = "cart-badge"; b.style.display = "none";
      a.appendChild(b); badgeEls.push(b);
    });
    // "Add to cart" buttons on product cards
    var adds = document.querySelectorAll(".prod__add");
    Array.prototype.forEach.call(adds, function (btn) {
      btn.addEventListener("click", function (e) {
        var prod = btn.closest(".prod");
        if (!prod) return;                 // not a product card — leave default behaviour
        e.preventDefault();
        addFromCard(prod);
      });
    });
  }

  // keep multiple open tabs in sync
  window.addEventListener("storage", function (e) { if (e.key === KEY) { items = read(); render(); } });

  function init() { buildDOM(); wire(); render(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

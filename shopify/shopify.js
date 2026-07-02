/* ============================================================
   F1 Ebikes - Shopify Storefront API client (browser, dependency-free)
   Reusable core for the headless integration. Reads window.F1_SHOPIFY
   (shopify-config.js). Exposes window.F1Shopify.

   Nothing here runs on its own - it only acts when its functions are called
   by page code / the cart. If the store isn't configured yet,
   F1Shopify.configured is false and callers should fall back to the demo cart.

   Scope of the PUBLIC Storefront token: read published products + create/
   mutate carts + get a checkoutUrl. No customer data, no admin. Safe in-browser.
   ============================================================ */
(function (w) {
  var CFG = w.F1_SHOPIFY || {};
  var CART_KEY = "f1_shopify_cart_id";
  var configured = !!(CFG.domain && CFG.token);

  function endpoint() {
    return "https://" + CFG.domain + "/api/" + (CFG.version || "2024-10") + "/graphql.json";
  }

  // ---- low-level GraphQL ----
  function sf(query, variables) {
    if (!configured) return Promise.reject(new Error("Shopify not configured"));
    return fetch(endpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": CFG.token
      },
      body: JSON.stringify({ query: query, variables: variables || {} })
    })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (json.errors && json.errors.length) throw new Error(json.errors[0].message);
        if (json.data && json.data.userErrors && json.data.userErrors.length) {
          throw new Error(json.data.userErrors[0].message);
        }
        return json.data;
      });
  }

  function money(amount, currency) {
    var n = typeof amount === "number" ? amount : parseFloat(amount);
    return "$" + n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      + (currency && currency !== (CFG.currency || "AUD") ? " " + currency : "");
  }

  // ---- products ----
  var PRODUCT_Q =
    "query($handle:String!){ product(handle:$handle){ id title handle " +
    "options{ name values } " +
    "variants(first:100){ nodes{ id title availableForSale quantityAvailable " +
    "price{ amount currencyCode } selectedOptions{ name value } } } } }";

  function getProduct(handle) {
    return sf(PRODUCT_Q, { handle: handle }).then(function (d) {
      if (!d || !d.product) throw new Error("Product not found: " + handle);
      return d.product;
    });
  }

  // Find the variant whose selectedOptions match every entry in `opts`
  // e.g. variantForOptions(product, { "Wheel size": "27.5″", "Display": "UKC1" })
  function variantForOptions(product, opts) {
    var wanted = opts || {};
    var keys = Object.keys(wanted);
    var nodes = (product.variants && product.variants.nodes) || [];
    for (var i = 0; i < nodes.length; i++) {
      var v = nodes[i], ok = true;
      for (var k = 0; k < keys.length; k++) {
        var name = keys[k], match = false;
        for (var s = 0; s < v.selectedOptions.length; s++) {
          if (v.selectedOptions[s].name === name && v.selectedOptions[s].value === wanted[name]) { match = true; break; }
        }
        if (!match) { ok = false; break; }
      }
      if (ok) return v;
    }
    return null;
  }

  // ---- cart ----
  var CART_FIELDS =
    "id checkoutUrl totalQuantity cost{ subtotalAmount{ amount currencyCode } } " +
    "lines(first:100){ nodes{ id quantity " +
    "cost{ totalAmount{ amount currencyCode } amountPerQuantity{ amount currencyCode } } " +
    "attributes{ key value } " +
    "merchandise{ ... on ProductVariant { id title price{ amount currencyCode } " +
    "image{ url } product{ title handle } selectedOptions{ name value } } } } } ";

  function cartId() { try { return w.localStorage.getItem(CART_KEY) || ""; } catch (e) { return ""; } }
  function setCartId(id) { try { if (id) w.localStorage.setItem(CART_KEY, id); else w.localStorage.removeItem(CART_KEY); } catch (e) {} }

  // line = { merchandiseId, quantity, attributes?:[{key,value}] }
  function cartCreate(lines) {
    var q = "mutation($lines:[CartLineInput!]){ cartCreate(input:{lines:$lines}){ cart{ " + CART_FIELDS + "} userErrors{ message } } }";
    return sf(q, { lines: lines }).then(function (d) { var c = d.cartCreate.cart; setCartId(c.id); return c; });
  }
  function cartGet() {
    var id = cartId();
    if (!id) return Promise.resolve(null);
    var q = "query($id:ID!){ cart(id:$id){ " + CART_FIELDS + "} }";
    return sf(q, { id: id }).then(function (d) { if (!d.cart) setCartId(""); return d.cart; });
  }
  function cartLinesAdd(lines) {
    var id = cartId();
    if (!id) return cartCreate(lines);
    var q = "mutation($id:ID!,$lines:[CartLineInput!]!){ cartLinesAdd(cartId:$id,lines:$lines){ cart{ " + CART_FIELDS + "} userErrors{ message } } }";
    return sf(q, { id: id, lines: lines }).then(function (d) {
      var c = d.cartLinesAdd.cart;
      if (!c) return cartCreate(lines); // cart expired -> start a fresh one
      return c;
    });
  }
  function cartLinesUpdate(lineId, quantity) {
    var q = "mutation($id:ID!,$lines:[CartLineUpdateInput!]!){ cartLinesUpdate(cartId:$id,lines:$lines){ cart{ " + CART_FIELDS + "} userErrors{ message } } }";
    return sf(q, { id: cartId(), lines: [{ id: lineId, quantity: quantity }] }).then(function (d) { return d.cartLinesUpdate.cart; });
  }
  function cartLinesRemove(lineIds) {
    var q = "mutation($id:ID!,$ids:[ID!]!){ cartLinesRemove(cartId:$id,lineIds:$ids){ cart{ " + CART_FIELDS + "} userErrors{ message } } }";
    return sf(q, { id: cartId(), ids: [].concat(lineIds) }).then(function (d) { return d.cartLinesRemove.cart; });
  }

  w.F1Shopify = {
    configured: configured,
    money: money,
    sf: sf,
    getProduct: getProduct,
    variantForOptions: variantForOptions,
    getCart: cartGet,
    addLines: cartLinesAdd,      // ensures a cart exists, then adds; returns cart {checkoutUrl, lines, cost}
    updateLine: cartLinesUpdate,
    removeLine: cartLinesRemove,
    clearCart: function () { setCartId(""); }
  };
})(window);

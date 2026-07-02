/* ============================================================
   F1 Ebikes - product page slug -> Shopify product handle map
   The only per-product integration config. Variant IDs are NEVER hardcoded
   here - they are resolved at runtime from the selected options via
   F1Shopify.variantForOptions (see shopify.js).

   NOTE: the kit handles below are the CURRENT combo-product handles. After
   the kit restructure (Stage 3 / blocker #3) the kits become variant
   products (Wheel x Display); update these handles to the new products then.
   ============================================================ */
window.F1_MAP = {
  // Kits (restructure to Wheel x Display variant products, then update handle)
  "kit-1500w": "1500w-ebike-kit-52v-20ah-combo",
  "kit-2000w": "2000w-ebike-kit-with-battery",
  "kit-3000w": "3000w-ebike-kit-with-battery",
  "kit-5000w": "5000w-ebike-kit-with-battery",

  // Battery (confirm this "-copy" handle is canonical)
  "battery": "52v-72v-bike-batterys-copy",

  // Wheels
  "hub-motor-wheel": "",                 // needs a real product (4 wattage variants) - client to create
  "wheels-17-supermoto": "17-inch-3000w-supermoto-wheels",

  // Accessories
  "forks-kke": "kke-forks",
  "display-ukc1": "ukc1-display",
  "display-eggrider": "eggrider-style-display",
  "throttle-surron": "plug-and-play-surron-throttle",
  "battery-bag-72v": "72v-battery-bag",
  "grips-odi": "odi-grips",

  // Controllers
  "controller-40a": "40a-dualmode-controller",
  "controller-45a": "45a-dual-mode-controller",
  "controller-80a": "80a-dual-mode-controller-copy"
};

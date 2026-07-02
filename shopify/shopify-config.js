/* ============================================================
   F1 Ebikes - Shopify Storefront connection config
   Fill these in with your DEV store first (Stage 2), then swap to the
   client's real store at cutover (Stage 6). Only the PUBLIC Storefront
   token belongs here - it is browser-safe (read published catalogue +
   cart writes only). NEVER put an Admin API token or webhook secret here.

   Until `token` is a real value, window.F1Shopify.configured is false and
   the site keeps using the existing demo cart untouched.
   ============================================================ */
window.F1_SHOPIFY = {
  domain: "",            // e.g. "f1ebikes-dev.myshopify.com"
  token: "",             // Storefront API PUBLIC access token from the Headless channel
  version: "2024-10",
  currency: "AUD"
};

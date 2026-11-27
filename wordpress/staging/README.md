# Marianas Coffee — WordPress / WooCommerce Staging MU-Plugins

> **WARNING: STAGING REVIEW ONLY**
> Do **not** upload any file in this directory to production (`shop.marianascoffee.com`).
> Do **not** install on `regionaltest.shop.marianascoffee.com` until database/file isolation,
> a fresh Hostinger backup, Hostinger directory password protection, and Stripe test mode
> are explicitly verified and approved by the owner.

## Files Included

1. `mu-plugins/marianas-staging-guard.php`
   - **Staging host fail-safe:** Only activates when `HTTP_HOST` matches `MARIANAS_STAGING_HOST`
     (default: `regionaltest.shop.marianascoffee.com`). If accidentally copied to production, it
     logs a warning and exits without modifying production behavior.
   - Blocks search engine indexing (`X-Robots-Tag`, `wp_robots`, `blog_public=0`, `robots.txt`).
   - Suppresses outgoing WordPress and WooCommerce emails (`pre_wp_mail`, `woocommerce_mail_callback`)
     so staging tests never email real customers.
   - Detects live Stripe configuration (`testmode !== 'yes'` or `pk_live_`/`sk_live_` keys) in
     read-only mode and disables Stripe gateways on staging until test mode is confirmed.

2. `mu-plugins/marianas-woo-checkout-handoff.php`
   - Handles multi-item headless cart handoff via `/checkout/?mc_cart=<id>:<qty>,<id>:<qty>&lang=<locale>`.
   - Validates syntax, caps lines (`20`) and quantities (`1..20`), and verifies every product against
     WooCommerce (`publish`, purchasable, in stock, positive price, sufficient stock) before
     touching the cart.
   - Uses native `WC()->cart->empty_cart()` and `WC()->cart->add_to_cart()` with WooCommerce's own
     database pricing — never accepts client-supplied prices or redirect URLs.
   - Redirects with `wp_safe_redirect()` (`303`) to `wc_get_checkout_url()` (or `wc_get_cart_url()`
     with a notice on validation failure) to prevent open redirects and duplicate adds on refresh.

3. `mu-plugins/marianas-woo-multilingual-checkout.php`
   - Preserves the storefront's selected language (`en`, `zh`, `ko`, `ja`) through WooCommerce
     checkout using a strict allowlist (`en_US`, `zh_CN`, `ko_KR`, `ja_JP`).
   - Persists validated language in a `SameSite=Lax` cookie (`mc_checkout_lang`) for front-end
     checkout requests without altering WP-Admin user locales.
   - Saves `_mc_order_locale` on created orders so WooCommerce order emails can render in the
     customer's selected language once the corresponding WordPress/WooCommerce language packs
     (`zh_CN`, `ko_KR`, `ja`) are installed on WordPress.

## Single-Item vs. Multi-Item Checkout Handoff

- **Single-item cart (default in `lib/woo/checkout.ts`):**
  `/checkout/?add-to-cart=<id>&quantity=<qty>&lang=<locale>` works natively with classic
  WooCommerce even before `marianas-woo-checkout-handoff.php` is installed, while
  `marianas-woo-multilingual-checkout.php` preserves `lang`.
- **Multi-item cart:**
  `/checkout/?mc_cart=<id>:<qty>,<id>:<qty>&lang=<locale>` requires
  `marianas-woo-checkout-handoff.php` on the WooCommerce site.

## Rollback

Each MU-plugin is self-contained and makes no database schema changes. To roll back on staging,
delete the individual `.php` file from `wp-content/mu-plugins/`.

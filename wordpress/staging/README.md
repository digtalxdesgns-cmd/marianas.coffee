# Marianas Coffee — WordPress / WooCommerce Staging MU-Plugins

> **WARNING: STAGING ONLY — DO NOT INSTALL ON PRODUCTION (`shop.marianascoffee.com`)**
> Install these files **only** on `regionaltest.shop.marianascoffee.com` after explicit owner
> approval and completion of the pre-install checklist below.

## Files Included

1. `mu-plugins/marianas-staging-guard.php`
   - **Production-host fail-safe:** Only activates when `HTTP_HOST` strictly matches
     `MARIANAS_STAGING_HOST` (default: `regionaltest.shop.marianascoffee.com`). If accidentally
     copied to production, it logs a warning and exits with zero hooks registered.
   - **Indexing protection:** Forces `X-Robots-Tag: noindex, nofollow, noarchive`,
     `blog_public = 0`, `wp_robots`, and `robots.txt` `Disallow: /`.
   - **Configurable email suppression:** Controlled by `MARIANAS_STAGING_SUPPRESS_EMAILS`
     (default: `false` so controlled owner test emails remain enabled). Add
     `define( 'MARIANAS_STAGING_SUPPRESS_EMAILS', true );` to staging `wp-config.php` to suppress
     all outgoing WordPress and WooCommerce emails.
   - **Live-payment safety lock:** Blocks live Stripe (`stripe` / `stripe_*` when `testmode !== 'yes'`
     or live keys exist) and other live online card/wallet gateways (`woocommerce_payments`,
     `ppcp-gateway`, `paypal`, `square_credit_card`, `2checkout*`) on staging while keeping
     harmless offline gateways (`cod`, `bacs`, `cheque`) or confirmed test-mode gateways intact.

2. `mu-plugins/marianas-woo-checkout-handoff.php`
   - Handles deterministic cart handoff via `/checkout/?mc_cart=<id>:<qty>[,<id>:<qty>...]&lang=<locale>`
     (supports both single-item and multi-item carts up to 20 lines / 20 qty each).
   - Validates syntax, caps lines and quantities, and verifies every product against WooCommerce
     (`publish`, `simple`/`variation`, purchasable, in stock, positive DB price, sufficient stock,
     and `sold_individually`) before modifying the cart.
   - Initializes the WooCommerce session cookie for new visitors, calls `WC()->cart->empty_cart()`,
     `WC()->cart->add_to_cart()`, `WC()->cart->calculate_totals()`, and `WC()->session->save_data()`.
   - Sends `nocache_headers()` and performs a `303` `wp_safe_redirect()` to `wc_get_checkout_url()`
     (or `wc_get_cart_url()` with an error notice on failure) — preventing open redirects, cached
     handoffs, and duplicate adds on refresh.

3. `mu-plugins/marianas-woo-multilingual-checkout.php`
   - Preserves the storefront's selected language (`en`, `zh`, `ko`, `ja`) through WooCommerce
     checkout using a strict allowlist (`en_US`, `zh_CN`, `ko_KR`, `ja_JP`).
   - Persists validated `?lang=` in a `SameSite=Lax; HttpOnly` cookie (`mc_checkout_lang`) with
     `nocache_headers()` on `?lang=` switches, without altering WP-Admin non-AJAX locales.
   - Stores `_mc_order_locale` on created orders and switches/restores locale for customer-facing
     WooCommerce order emails.

---

## Minimal Staging Deployment Checklist (Owner Approval Required)

### Pre-Install Verification (Staging WP-Admin — `regionaltest.shop.marianascoffee.com/wp-admin`)

1. **Confirm live payment gateways are disabled & purge cache**
   - Go to **WooCommerce → Settings → Payments**.
   - Ensure **Stripe** (and any other online card/wallet gateway) is **disabled**, then click **Save changes**.
   - If Hostinger **LiteSpeed Cache** is active, click **Purge All** so `/wp-json/wc/store/v1/cart` no longer advertises `["stripe"]`.
2. **Install WordPress & WooCommerce language packs (`zh_CN`, `ko_KR`, `ja`)**
   - English (`en_US`) is built in.
   - Go to **Settings → General → Site Language**, temporarily select and save **简体中文 (`zh_CN`)**, **한국어 (`ko_KR`)**, and **日本語 (`ja`)** once each (or install via **Dashboard → Updates → Update Translations**), then switch Site Language back to **English (United States)**.
   - Confirm `.mo` / `.l10n.php` translation files exist under `wp-content/languages/` and `wp-content/languages/plugins/woocommerce-*.mo`.

### Upload MU-Plugins (Staging ONLY — Hostinger hPanel File Manager)

3. Open **Hostinger hPanel → Websites → `regionaltest.shop.marianascoffee.com` → File Manager**.
4. Navigate to `wp-content/mu-plugins/` (create the `mu-plugins` folder if it does not exist).
5. Upload the three PHP-validated files and the companion custom translation dictionary folder:
   - `marianas-staging-guard.php`
   - `marianas-woo-checkout-handoff.php`
   - `marianas-woo-multilingual-checkout.php`
   - `marianas-i18n/translations.json` (version-controlled custom 4-language dictionary; requires owner translation review & approval before treating copy as final)
6. Purge Hostinger **LiteSpeed Cache** and verify in **Staging WP-Admin**:
   - The yellow **Marianas Staging Environment** banner appears confirming search indexing is blocked and owner test emails are enabled.
   - No red **Payment Safety Lock Active** banner appears (if it does, Stripe still has live settings active).

### Post-Install Verification (No Live Payments)

7. Visit `https://regionaltest.shop.marianascoffee.com/wp-json/wc/store/v1/cart` and confirm `payment_methods` contains no live card gateway.
8. Verify single-item and multi-item handoff from local `/shop` in `en`, `zh`, `ko`, and `ja` without submitting live payments.

### Rollback

Each MU-plugin is self-contained and makes no database schema changes. To roll back immediately,
delete the individual `.php` file(s) from `wp-content/mu-plugins/` on staging and purge cache.

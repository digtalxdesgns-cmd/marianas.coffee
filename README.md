# Marianas Coffee — Next.js

Vercel-ready Next.js version of the approved Marianas Coffee website.

## Included

- Simple, responsive beach-and-surf homepage
- English, Chinese, Korean, and Japanese translations
- Persistent language preference
- Marianas Coffee logo and current image assets
- Saipan story video and historical carved accent
- Product preview linked directly to the WooCommerce shop
- Wholesale and newsletter interactions ready for final service connections
- WooCommerce shop handoff through an environment variable
- SEO metadata and accessible controls

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_SHOP_URL` to the WordPress/WooCommerce shop URL.
4. Run `npm run dev`.

## Deploy to Vercel

1. Push this folder to GitHub, GitLab, or Bitbucket.
2. Import the repository into Vercel.
3. Add `NEXT_PUBLIC_SHOP_URL` in Vercel project settings.
4. Deploy.
5. Point `marianascoffee.com` and `www` to Vercel in Hostinger DNS.
6. Keep `shop.marianascoffee.com` pointed to the Hostinger WordPress installation.

Do not remove existing email MX, SPF, DKIM, or DMARC records when changing DNS.

## Before launch

- Replace prototype products and prices with the live WooCommerce catalog.
- Connect the wholesale and newsletter forms to the preferred form/email service.
- Confirm the final phone numbers, policies, analytics, and product URLs.

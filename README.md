# Boost Point — online shop prototype

A clickable storefront prototype for **Boost Point** (advertising, printing & promotional products).

Open `index.html` in any browser — no build step, no server needed.

## What's in it

- **Catalogue of 52 products** across 5 categories: Large Format, Stickers & Labels, Print & Stationery, Promo Products, Signage & UV Print
- Search, category filters and sorting
- **Product configurator**: size, material/finish and quantity tiers with live pricing and volume discounts
- Artwork upload field on each product
- **Cart & checkout** (cart persists in the browser; checkout is a demo, nothing is sent or charged)
- "How it works" ordering steps and a custom-quote request form
- Works on phones, tablets and desktop; supports light and dark mode

## Editing sample data

All products, prices and options live in the `P` array inside the `<script>` at the bottom of `index.html`.
Each row is: `[name, category, icon, base unit price, quantity ladder, description, sizes, materials, 'hot'?]`.
Prices are placeholders in USD; VAT (11%) and the free-delivery threshold ($150) are in the `totals()` function.

## Next steps toward a real shop

- Replace icons with real product photos
- Connect a backend / e-commerce platform (e.g. Shopify, WooCommerce, or a custom API) for orders, payments and artwork storage
- Add customer accounts, order tracking and an admin panel for managing products and prices

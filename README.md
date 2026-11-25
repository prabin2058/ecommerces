# Prabin Store

One repo with three apps and a small shared package:

```
ecommerces/
├── frontend/    Customer storefront: shop, cart, checkout, accounts          → http://localhost:5173
├── dashboard/   Admin dashboard: products, stock, orders, coupons, reports   → http://localhost:5180
├── backend/     Express + MongoDB API, used by both apps                     → http://localhost:5050
└── shared/      @store/shared: UI kit, API client, formatting, Tailwind theme
```

Both apps proxy `/api` to the backend in dev, so login and cart cookies stay same-origin.

## Run locally

```bash
npm install                    # installs all workspaces
docker start ecommerces-mongo  # or any MongoDB on localhost:27017
npm run seed                   # demo catalog, coupons, staff accounts (add -- --reset to wipe)
npm run dev                    # starts backend, frontend and dashboard together
```

Run one app at a time with `npm run dev:backend`, `npm run dev:frontend` or `npm run dev:dashboard`. `npm run build` builds both web apps.

Seeded staff logins are written to `test-account.local` (git-ignored). Use them at the dashboard URL.

Each app has its own `.env` (see `.env.example` in each folder). If a port is taken, Vite picks the next free one. In that case, set `VITE_STORE_URL` (dashboard) or `VITE_DASHBOARD_URL` (frontend) so the cross-links point to the right place.

## What's in it

| Area | Highlights |
| --- | --- |
| Storefront | Search with suggestions, category/price/brand filters, variant picker that knows stock per combination, server-side cart (guest cookie or account), save for later, coupons, free-shipping progress |
| Checkout | 3 steps (contact & address → delivery → review & pay), saved addresses, server re-pricing, change detection before payment, idempotent Place order, card / wallet / bank / cash on delivery |
| Payments | Sandbox gateway with a hosted page, HMAC-signed webhooks (replay-protected, idempotent), retry after decline, refunds, reconciliation |
| Admin | Dashboard (revenue, funnel, alerts), products with variants, pre-signed image uploads, stock adjustments with history, publish checklist and scheduling, bulk actions, CSV import (dry run) / export, orders with status workflow, coupons, categories, audit log, roles, TOTP 2FA |

Money is stored as integer paisa everywhere (`120000` = Rs 1,200).

### Sandbox test cards (MockPay)

| Card | Result |
| --- | --- |
| 4242 4242 4242 4242 | Approved |
| 4000 0000 0000 0002 | Declined |
| 4000 0000 0000 9995 | Insufficient funds |

## Correctness guarantees

- Stock is reserved at Place order with an atomic conditional update (`onHand - reserved >= qty`), never read-then-write; reservations expire after 15 minutes.
- The `Idempotency-Key` header plus a key lock means a double-click creates one order and one payment session.
- Orders become paid only via a verified webhook or a direct gateway lookup, never from the browser redirect.
- A job runs every minute to reconcile late webhooks, expire reservations, publish scheduled products and send abandoned-cart reminders. Reconciliation against gateway settlements runs daily.

## Not production-ready yet

- **Payment gateway:** MockPay stands in for a real provider (Khalti, eSewa, Stripe). Swap `backend/src/gateway/mockGateway.js` for a real adapter with the same `createSession` / `retrieve` / `refund` / `settlements` shape.
- **Images:** stored on local disk behind a signed upload URL. Point the presign step at S3/R2 and add resizing/WebP (for example `sharp` in a worker) plus a CDN.
- **Single process:** cache, rate limits and jobs live in-process. Use Redis and a job queue (BullMQ) once you run more than one API instance.
- **Notifications:** email/SMS go to an outbox collection (visible in Admin → Activity). They are not sent yet; wire up an SMTP or SMS provider.
- **Stock and transactions:** one warehouse only. Multi-item reservation uses compensation (rollback) rather than a Mongo transaction, because the local Mongo isn't a replica set.
- **Monitoring:** no Sentry or load testing.

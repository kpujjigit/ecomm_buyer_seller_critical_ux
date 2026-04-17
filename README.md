# Sentry Custom Spans Demo — C2C Marketplace

A sample Next.js app that emits a rich custom span attribute schema for a
generic consumer-to-consumer marketplace, plus a traffic simulator that
generates realistic volumes of buyer/seller journey spans so two dashboards
can be populated in Sentry:

1. **Seller Journey Health** — listings published, photo-upload failure rate
   by network type, smart-pricing acceptance, payout latency by method,
   KYC-blocked payout errors.
2. **Buyer Journey Health** — search→view conversion, checkout→confirm
   conversion, checkout p95 by payment method, payment decline rate, BNPL
   adoption, failed-checkouts-with-replay, return rate by reason.

The UI is intentionally minimal — the point is the **data shape** landing in
Sentry, and showing how to express business-meaningful dashboard queries on
top of it.

---

## Setup

```bash
npm install
cp .env.example .env.local
# Edit .env.local — paste a Sentry DSN for the project you want data to land in
```

### Required env vars

| Var | Purpose |
|-----|---------|
| `SENTRY_DSN` | Project DSN (client + server SDKs). The demo fails fast if unset. |
| `SENTRY_RELEASE` | Tagged as `app.release` on every span. Default: `marketplace-web@<today>-demo` |
| `SENTRY_ENVIRONMENT` | Tagged as `app.environment`. Default: `demo` |
| `SIM_CONCURRENCY` | Number of synthetic users for the traffic simulator. Default: 8 |
| `SIM_DURATION_SEC` | Simulator runtime. `0` = forever. `--burst` flag overrides to 60s. |

---

## Run

```bash
# Next.js demo app (click through buyer + seller journeys manually)
npm run dev
# → http://localhost:3030

# Traffic simulator (populate dashboards with realistic volumes)
npm run simulate          # runs forever, 8 concurrent users
npm run simulate:burst    # 60-second burst — good for a live demo
```

Stop the simulator with `Ctrl+C`; it flushes Sentry before exiting.

---

## What lands in Sentry

### Global attributes — on every span

`user.id`, `user.segment` (buyer/seller/both/guest), `user.tenure_days`,
`user.country`, `user.is_kyc_verified`, `app.platform` (web/ios/android),
`app.release`, `app.environment`, `app.locale`, `experiment.variant`.

### Span ops emitted

**Seller:** `seller.listing.create`, `seller.photo.upload`,
`seller.pricing.suggest`, `seller.offer.respond`, `seller.shipping.label`,
`seller.payout.process`.

**Buyer:** `buyer.search.query`, `buyer.listing.view`, `buyer.offer.make`,
`buyer.cart.add`, `buyer.checkout.start`, `buyer.checkout.payment`,
`buyer.checkout.confirm`, `buyer.shipping.track`, `buyer.return.initiate`.

### Error injection (on by default)

| Failure mode | ~Rate in simulator | Span where it lands |
|---|---|---|
| Photo upload network timeout | ~1.5% per photo | `seller.photo.upload` |
| KYC-blocked payout | ~85% of non-KYC sellers | `seller.payout.process` |
| Payment decline (Stripe-style codes) | ~3.5% | `buyer.checkout.payment` |

---

## Dashboards to build

Once traffic is flowing, create two dashboards in Sentry → Insights →
Dashboards and add these widgets. Every query uses the attributes above and
will resolve without any extra configuration.

### Dashboard 1 — Buyer Journey Health

| Widget | Query (Discover / Dashboard DSL) |
|---|---|
| Search → view conversion | `count(span.op:buyer.listing.view) / count(span.op:buyer.search.query)` |
| Checkout start → confirm conversion | `count(span.op:buyer.checkout.confirm) / count(span.op:buyer.checkout.start)` |
| Checkout p95 by payment method | `p95(span.duration)` where `span.op:buyer.checkout.confirm`, group by `checkout.payment_method` |
| Payment decline rate | `count()` where `has:payment.decline_reason` / `count(span.op:buyer.checkout.payment)` |
| BNPL adoption | `count()` where `checkout.is_bnpl:true` / `count(span.op:buyer.checkout.confirm)` |
| Decline rate by card network | `count()` where `has:payment.decline_reason`, group by `checkout.card_network` |
| p95 search latency, web vs mobile | `p95(span.duration)` where `span.op:buyer.search.query`, group by `app.platform` |
| Return rate by reason | `count(span.op:buyer.return.initiate)`, group by `return.reason` |
| Failed checkouts with replay | `count()` where `span.op:buyer.checkout.payment has:payment.decline_reason has:replay.id` — one-click jump to replay |

### Dashboard 2 — Seller Journey Health

| Widget | Query |
|---|---|
| Listings created / hour | `count(span.op:seller.listing.create)` |
| Listing create p95 | `p95(span.duration)` where `span.op:seller.listing.create` |
| Photo upload failure rate by network | `failure_rate()` where `span.op:seller.photo.upload`, group by `upload.network_type` |
| Smart-pricing acceptance rate | `count()` where `span.op:seller.listing.create listing.price_usd:==listing.smart_price_suggested_usd` / `count(span.op:seller.listing.create)` |
| Offer response time distribution | `p50(offer.time_to_respond_seconds), p95(...), p99(...)` |
| Payout p95 by method | `p95(span.duration)` where `span.op:seller.payout.process`, group by `payout.method` |
| KYC-blocked payout errors | `count()` where `span.op:seller.payout.process has:payout.error user.is_kyc_verified:false` |
| Seller cohort split | `count(span.op:seller.listing.create)`, group by `user.segment` (buyer vs seller vs both) |

### Cross-cutting (optional)

| Widget | Query |
|---|---|
| Error rate by release | `count()` where `event.type:error`, group by `app.release` |
| A/B — checkout p95 by experiment | `p95(span.duration)` where `span.op:buyer.checkout.confirm`, group by `experiment.variant` |

---

## File map

```
.
├── sentry.client.config.ts    # Browser SDK — demonstrates 1% session replay, 100% on error
├── sentry.server.config.ts    # Node SDK
├── instrumentation.ts         # Next.js v8+ Sentry bootstrap hook
├── lib/
│   ├── fixtures.ts            # Sample categories, carriers, payment methods, decline codes
│   ├── random.ts              # Seedable RNG + helpers
│   ├── sentry-context.ts      # applyGlobalContext(), globalSpanAttributes()
│   ├── journeys.ts            # Every span emitter (heart of the demo)
│   └── api-helpers.ts         # Builds UserProfile/AppContext from a request
├── app/
│   ├── buyer/page.tsx         # Click-to-emit buyer spans
│   ├── seller/page.tsx        # Click-to-emit seller spans
│   └── api/
│       ├── buyer/{search,checkout,full-journey}/route.ts
│       └── seller/{listing,payout,full-journey}/route.ts
└── scripts/
    └── simulate.ts            # Traffic simulator — populates dashboards at scale
```

---

## Demo flow

1. `npm run simulate:burst` in one terminal. ~60 seconds of traffic → ~5K spans.
2. In Sentry → Explore → Traces, filter by `span.op:buyer.checkout.*`. Show
   one end-to-end trace with all checkout attributes populated.
3. Open the **Buyer Journey Health** dashboard. Point at the BNPL adoption
   widget and the decline-rate-by-card-network widget — the kind of
   merchandising/finance question most teams can't answer from traces today.
4. Switch to `span.op:seller.photo.upload` and group by `upload.network_type`.
   The `cellular_3g` bucket will stand out — the kind of mobile-perf insight
   that surfaces only when infra spans carry business-meaningful tags.
5. Click into a `seller.payout.process` error. Show the `user.segment` and
   `user.is_kyc_verified` tags on the event — user-impact attribution that
   generic error tracking misses.

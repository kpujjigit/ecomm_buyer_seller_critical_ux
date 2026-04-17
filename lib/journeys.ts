// Journey span emitters — the heart of the demo.
//
// Each function corresponds to a span name defined in Section 3 of the value
// framework doc. Attributes are named exactly as documented so that any
// Discover query / dashboard widget from Section 4 will work out of the box.
//
// All functions take a `SentryLike` client so they work with either
// @sentry/nextjs (Next.js API routes) or @sentry/node (traffic simulator).

import {
  type SentryLike,
  type UserProfile,
  type AppContext,
  globalSpanAttributes,
} from './sentry-context';
import {
  pick,
  randInt,
  randFloat,
  chance,
  opaqueId,
  type Rng,
} from './random';
import {
  CARRIERS,
  CATEGORIES,
  CONDITIONS,
  DECLINE_REASONS,
  LISTING_SOURCES,
  NETWORK_TYPES,
  PAYMENT_METHODS,
  RETURN_REASONS,
} from './fixtures';

// Sleep helper — used to give spans a realistic duration shape.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// SELLER JOURNEY
// ============================================================================

/** seller.photo.upload — one span per photo uploaded. */
export async function sellerPhotoUpload(
  sentry: SentryLike,
  rng: Rng,
  user: UserProfile,
  app: AppContext,
  opts: { forceSlow?: boolean; forceFail?: boolean } = {},
): Promise<void> {
  const networkType = pick(rng, NETWORK_TYPES);
  const bytes = randInt(rng, 500_000, 8_000_000);
  const compressionRatio = randFloat(rng, 0.2, 0.7);
  const retryCount = opts.forceFail ? 3 : chance(rng, 0.08) ? randInt(rng, 1, 2) : 0;

  // Cellular uploads are slower; throttled networks even more so.
  const baseLatencyMs =
    networkType === 'wifi'
      ? randInt(rng, 80, 260)
      : networkType === 'cellular_5g'
      ? randInt(rng, 150, 400)
      : networkType === 'cellular_4g'
      ? randInt(rng, 300, 900)
      : randInt(rng, 1200, 3500);
  const latencyMs = opts.forceSlow ? baseLatencyMs * 5 : baseLatencyMs;

  await sentry.startSpan(
    {
      name: 'seller.photo.upload',
      op: 'seller.photo.upload',
      attributes: {
        ...globalSpanAttributes(user, app),
        'upload.bytes': bytes,
        'upload.mime_type': pick(rng, ['image/jpeg', 'image/heic', 'image/png']),
        'upload.compression_ratio': Number(compressionRatio.toFixed(2)),
        'upload.network_type': networkType,
        'upload.retry_count': retryCount,
      },
    },
    async (span) => {
      await sleep(latencyMs);
      if (opts.forceFail) {
        const err = new Error('Photo upload failed after 3 retries (network timeout)');
        span?.setAttribute('upload.error', 'network_timeout');
        span?.setStatus?.({ code: 2, message: 'internal_error' });
        sentry.captureException(err);
        throw err;
      }
    },
  );
}

/** seller.pricing.suggest — Smart Pricing ML suggestion. */
export async function sellerPricingSuggest(
  sentry: SentryLike,
  rng: Rng,
  user: UserProfile,
  app: AppContext,
  listingPriceUsd: number,
): Promise<{ suggestedUsd: number; confidence: number }> {
  const modelLatencyMs = randInt(rng, 120, 480);
  const confidence = randFloat(rng, 0.55, 0.97);
  const suggestedUsd = Number(
    (listingPriceUsd * randFloat(rng, 0.82, 1.12)).toFixed(2),
  );
  const priceRangeLow = Number((suggestedUsd * 0.88).toFixed(2));
  const priceRangeHigh = Number((suggestedUsd * 1.16).toFixed(2));

  await sentry.startSpan(
    {
      name: 'seller.pricing.suggest',
      op: 'seller.pricing.suggest',
      attributes: {
        ...globalSpanAttributes(user, app),
        'ml.model_version': 'smart-pricing-v7.2',
        'ml.latency_ms': modelLatencyMs,
        'ml.confidence': Number(confidence.toFixed(2)),
        'ml.suggested_price_usd': suggestedUsd,
        'ml.price_range_low_usd': priceRangeLow,
        'ml.price_range_high_usd': priceRangeHigh,
      },
    },
    async () => sleep(modelLatencyMs),
  );

  return { suggestedUsd, confidence };
}

/**
 * seller.listing.create — end-to-end listing creation.
 * Nests photo upload + pricing suggestion spans inside.
 */
export async function sellerListingCreate(
  sentry: SentryLike,
  rng: Rng,
  user: UserProfile,
  app: AppContext,
): Promise<{ listingId: string }> {
  const category = pick(rng, CATEGORIES);
  const priceUsd = Number(randFloat(rng, 5, 899).toFixed(2));
  const photoCount = randInt(rng, 1, 10);
  const hasVideo = chance(rng, 0.18);
  const isLocalOnly = chance(rng, 0.12);
  const shippingPayer = chance(rng, 0.7) ? 'buyer' : 'seller';
  const condition = pick(rng, CONDITIONS);

  return sentry.startSpan(
    {
      name: 'seller.listing.create',
      op: 'seller.listing.create',
      forceTransaction: true,
      attributes: {
        ...globalSpanAttributes(user, app),
        'listing.category_l1': category.l1,
        'listing.category_l2': category.l2,
        'listing.price_usd': priceUsd,
        'listing.photo_count': photoCount,
        'listing.has_video': hasVideo,
        'listing.condition': condition,
        'listing.shipping_payer': shippingPayer,
        'listing.is_local_only': isLocalOnly,
      },
    },
    async (span) => {
      // Pricing suggestion comes first (pre-publish).
      const { suggestedUsd } = await sellerPricingSuggest(
        sentry,
        rng,
        user,
        app,
        priceUsd,
      );

      // Photos. A small % fail which bubbles to listing.create failure.
      let totalBytes = 0;
      try {
        for (let i = 0; i < photoCount; i++) {
          const forceFail = chance(rng, 0.015); // ~1.5% per-photo fail
          const forceSlow = chance(rng, 0.04); // ~4% slow outlier
          await sellerPhotoUpload(sentry, rng, user, app, { forceFail, forceSlow });
          totalBytes += randInt(rng, 400_000, 4_000_000);
        }
      } catch {
        // Photo upload already recorded the error. Mark listing.create as failed.
        span?.setAttribute('listing.publish_error', 'photo_upload_failed');
        span?.setStatus?.({ code: 2, message: 'photo_upload_failed' });
        throw new Error('listing creation failed: photo upload error');
      }

      const listingId = opaqueId(rng, 'm');

      // Post-create attrs now that we have an ID and total bytes.
      span?.setAttribute('listing.id', listingId);
      span?.setAttribute('listing.photo_total_bytes', totalBytes);
      span?.setAttribute('listing.smart_price_suggested_usd', suggestedUsd);

      return { listingId };
    },
  );
}

/** seller.offer.respond — seller responds to an incoming offer. */
export async function sellerOfferRespond(
  sentry: SentryLike,
  rng: Rng,
  user: UserProfile,
  app: AppContext,
): Promise<void> {
  const askingPriceUsd = Number(randFloat(rng, 10, 500).toFixed(2));
  const offerAmountUsd = Number(
    (askingPriceUsd * randFloat(rng, 0.5, 0.98)).toFixed(2),
  );
  const discountPct = Number(
    ((askingPriceUsd - offerAmountUsd) / askingPriceUsd).toFixed(3),
  );
  const response = pick(rng, ['accept', 'decline', 'counter'] as const);
  const timeToRespondSeconds = randInt(rng, 5, 60 * 60 * 6); // up to 6h

  await sentry.startSpan(
    {
      name: 'seller.offer.respond',
      op: 'seller.offer.respond',
      attributes: {
        ...globalSpanAttributes(user, app),
        'offer.id': opaqueId(rng, 'o'),
        'offer.amount_usd': offerAmountUsd,
        'offer.asking_price_usd': askingPriceUsd,
        'offer.discount_pct': discountPct,
        'offer.response': response,
        'offer.counter_amount_usd':
          response === 'counter'
            ? Number(
                (offerAmountUsd + (askingPriceUsd - offerAmountUsd) * 0.4).toFixed(
                  2,
                ),
              )
            : null,
        'offer.time_to_respond_seconds': timeToRespondSeconds,
      },
    },
    async () => sleep(randInt(rng, 40, 220)),
  );
}

/** seller.shipping.label — carrier label purchase. */
export async function sellerShippingLabel(
  sentry: SentryLike,
  rng: Rng,
  user: UserProfile,
  app: AppContext,
): Promise<void> {
  await sentry.startSpan(
    {
      name: 'seller.shipping.label',
      op: 'seller.shipping.label',
      attributes: {
        ...globalSpanAttributes(user, app),
        'shipping.carrier': pick(rng, CARRIERS),
        'shipping.service_level': pick(rng, [
          'ground_advantage',
          'priority_mail',
          'ups_ground',
          'fedex_home_delivery',
        ]),
        'shipping.label_cost_usd': Number(randFloat(rng, 3.75, 18.9).toFixed(2)),
        'shipping.weight_oz': Number(randFloat(rng, 2, 120).toFixed(1)),
      },
    },
    async () => sleep(randInt(rng, 180, 600)),
  );
}

/** seller.payout.process — end of seller journey. */
export async function sellerPayoutProcess(
  sentry: SentryLike,
  rng: Rng,
  user: UserProfile,
  app: AppContext,
): Promise<void> {
  const method = pick(rng, ['bank_ach', 'debit_card', 'merpay_wallet'] as const);
  const amount = Number(randFloat(rng, 5, 480).toFixed(2));
  const isInstant = method !== 'bank_ach' && chance(rng, 0.6);
  const fee = isInstant ? Number((amount * 0.02).toFixed(2)) : 0;

  // KYC-blocked payouts fail — this drives the "KYC-blocked payout errors"
  // widget in Section 4.1.
  const kycBlocked = !user.isKycVerified && chance(rng, 0.85);

  await sentry.startSpan(
    {
      name: 'seller.payout.process',
      op: 'seller.payout.process',
      forceTransaction: true,
      attributes: {
        ...globalSpanAttributes(user, app),
        'payout.method': method,
        'payout.amount_usd': amount,
        'payout.fee_usd': fee,
        'payout.is_instant': isInstant,
        'payout.kyc_tier': chance(rng, 0.7) ? 'basic' : 'enhanced',
      },
    },
    async (span) => {
      await sleep(randInt(rng, 200, 900));
      if (kycBlocked) {
        const err = new Error('PayoutError: KYC verification required');
        (err as Error & { type?: string }).type = 'PayoutError';
        span?.setAttribute('payout.error', 'kyc_required');
        span?.setStatus?.({ code: 2, message: 'kyc_required' });
        sentry.captureException(err);
        throw err;
      }
    },
  );
}

// ============================================================================
// BUYER JOURNEY
// ============================================================================

/** buyer.search.query */
export async function buyerSearchQuery(
  sentry: SentryLike,
  rng: Rng,
  user: UserProfile,
  app: AppContext,
): Promise<{ resultsCount: number; category: string }> {
  const queryText = pick(rng, [
    'iphone 14 pro',
    'louis vuitton bag',
    'nike dunk low',
    'ps5 digital',
    'sony headphones',
    'kitchenaid mixer',
    'lego star wars',
    'macbook air m2',
    'supreme hoodie',
    'air jordan 1',
  ]);
  const category = pick(rng, CATEGORIES);
  const esMs = randInt(rng, 12, 140);
  const mlMs = randInt(rng, 30, 210);
  const resultsCount = randInt(rng, 0, 4500);

  await sentry.startSpan(
    {
      name: 'buyer.search.query',
      op: 'buyer.search.query',
      attributes: {
        ...globalSpanAttributes(user, app),
        'search.query_hash': opaqueId(rng),
        'search.query_length': queryText.length,
        'search.filters_applied_count': randInt(rng, 0, 5),
        'search.category_filter': category.l2,
        'search.price_min_usd': Number(randFloat(rng, 0, 50).toFixed(2)),
        'search.price_max_usd': Number(randFloat(rng, 100, 1500).toFixed(2)),
        'search.results_count': resultsCount,
        'search.page_number': randInt(rng, 1, 8),
        'search.sort_order': pick(rng, [
          'relevance',
          'price_asc',
          'price_desc',
          'newest',
        ]),
        'search.elasticsearch_ms': esMs,
        'search.ml_rerank_ms': mlMs,
      },
    },
    async () => sleep(esMs + mlMs),
  );

  return { resultsCount, category: category.l2 };
}

/** buyer.listing.view */
export async function buyerListingView(
  sentry: SentryLike,
  rng: Rng,
  user: UserProfile,
  app: AppContext,
  opts: { source?: string } = {},
): Promise<{ listingId: string; priceUsd: number }> {
  const listingId = opaqueId(rng, 'm');
  const priceUsd = Number(randFloat(rng, 3, 650).toFixed(2));

  await sentry.startSpan(
    {
      name: 'buyer.listing.view',
      op: 'buyer.listing.view',
      attributes: {
        ...globalSpanAttributes(user, app),
        'listing.id': listingId,
        'listing.price_usd': priceUsd,
        'listing.seller_id_hash': opaqueId(rng, 'u'),
        'listing.seller_tenure_days': randInt(rng, 1, 3600),
        'listing.photos_loaded': randInt(rng, 1, 10),
        'listing.scroll_depth_pct': Number(randFloat(rng, 0.1, 1.0).toFixed(2)),
        'listing.time_on_page_seconds': randInt(rng, 2, 180),
        'listing.source': opts.source ?? pick(rng, LISTING_SOURCES),
      },
    },
    async () => sleep(randInt(rng, 150, 720)),
  );

  return { listingId, priceUsd };
}

/** buyer.offer.make */
export async function buyerOfferMake(
  sentry: SentryLike,
  rng: Rng,
  user: UserProfile,
  app: AppContext,
  askingPriceUsd: number,
): Promise<void> {
  const amount = Number(
    (askingPriceUsd * randFloat(rng, 0.55, 0.98)).toFixed(2),
  );
  await sentry.startSpan(
    {
      name: 'buyer.offer.make',
      op: 'buyer.offer.make',
      attributes: {
        ...globalSpanAttributes(user, app),
        'offer.amount_usd': amount,
        'offer.discount_pct': Number(
          ((askingPriceUsd - amount) / askingPriceUsd).toFixed(3),
        ),
        'offer.is_auto_accept': chance(rng, 0.15),
      },
    },
    async () => sleep(randInt(rng, 60, 280)),
  );
}

/** buyer.cart.add */
export async function buyerCartAdd(
  sentry: SentryLike,
  rng: Rng,
  user: UserProfile,
  app: AppContext,
  itemCount: number,
  subtotalUsd: number,
): Promise<void> {
  await sentry.startSpan(
    {
      name: 'buyer.cart.add',
      op: 'buyer.cart.add',
      attributes: {
        ...globalSpanAttributes(user, app),
        'cart.item_count': itemCount,
        'cart.subtotal_usd': subtotalUsd,
      },
    },
    async () => sleep(randInt(rng, 30, 120)),
  );
}

/** buyer.checkout.* — start → payment → confirm, bundled into one transaction.
 *  Returns whether the checkout succeeded so callers can branch. */
export async function buyerCheckout(
  sentry: SentryLike,
  rng: Rng,
  user: UserProfile,
  app: AppContext,
  subtotalUsd: number,
  opts: { forceDecline?: boolean } = {},
): Promise<{ confirmed: boolean; declineReason?: string }> {
  const paymentMethod = pick(rng, PAYMENT_METHODS);
  const isBnpl = paymentMethod === 'zip_bnpl';
  const protectionFeeUsd = Number((subtotalUsd * 0.036).toFixed(2));
  const shippingFeeUsd = Number(randFloat(rng, 2.99, 14.99).toFixed(2));
  const taxUsd = Number((subtotalUsd * 0.0725).toFixed(2));
  const totalUsd = Number(
    (subtotalUsd + protectionFeeUsd + shippingFeeUsd + taxUsd).toFixed(2),
  );
  const sessionId = opaqueId(rng, 'co_');

  const checkoutAttrs = {
    ...globalSpanAttributes(user, app),
    'checkout.session_id': sessionId,
    'checkout.subtotal_usd': subtotalUsd,
    'checkout.protection_fee_usd': protectionFeeUsd,
    'checkout.shipping_fee_usd': shippingFeeUsd,
    'checkout.tax_usd': taxUsd,
    'checkout.total_usd': totalUsd,
    'checkout.payment_method': paymentMethod,
    'checkout.card_network':
      paymentMethod === 'card' ? pick(rng, ['visa', 'mastercard', 'amex']) : null,
    'checkout.is_bnpl': isBnpl,
    'checkout.bnpl_provider': isBnpl ? 'zip' : null,
    'checkout.is_guest': user.segment === 'guest',
    'checkout.address_is_new': chance(rng, 0.22),
  };

  return sentry.startSpan(
    {
      name: 'buyer.checkout',
      op: 'buyer.checkout',
      forceTransaction: true,
      attributes: checkoutAttrs,
    },
    async () => {
      // Step 1: start
      await sentry.startSpan(
        { name: 'buyer.checkout.start', op: 'buyer.checkout.start', attributes: checkoutAttrs },
        async () => sleep(randInt(rng, 80, 260)),
      );

      // Step 2: payment (may decline)
      const declineReason = opts.forceDecline
        ? pick(rng, DECLINE_REASONS)
        : chance(rng, 0.035)
        ? pick(rng, DECLINE_REASONS)
        : undefined;

      const paymentSuccess = !declineReason;

      try {
        await sentry.startSpan(
          {
            name: 'buyer.checkout.payment',
            op: 'buyer.checkout.payment',
            attributes: {
              ...checkoutAttrs,
              'payment.processor':
                paymentMethod === 'zip_bnpl'
                  ? 'zip'
                  : chance(rng, 0.85)
                  ? 'stripe'
                  : 'braintree',
              'payment.3ds_required': chance(rng, 0.09),
              ...(declineReason ? { 'payment.decline_reason': declineReason } : {}),
            },
          },
          async (span) => {
            await sleep(randInt(rng, 350, 1400));
            if (declineReason) {
              const err = new Error(`Payment declined: ${declineReason}`);
              (err as Error & { code?: string }).code = declineReason;
              span?.setAttribute('payment.decline_reason', declineReason);
              span?.setStatus?.({ code: 2, message: declineReason });
              sentry.captureException(err);
              throw err;
            }
          },
        );
      } catch {
        return { confirmed: false, declineReason };
      }

      // Step 3: confirm
      if (paymentSuccess) {
        await sentry.startSpan(
          {
            name: 'buyer.checkout.confirm',
            op: 'buyer.checkout.confirm',
            attributes: checkoutAttrs,
          },
          async () => sleep(randInt(rng, 120, 420)),
        );
      }

      return { confirmed: paymentSuccess };
    },
  );
}

/** buyer.shipping.track */
export async function buyerShippingTrack(
  sentry: SentryLike,
  rng: Rng,
  user: UserProfile,
  app: AppContext,
): Promise<void> {
  await sentry.startSpan(
    {
      name: 'buyer.shipping.track',
      op: 'buyer.shipping.track',
      attributes: {
        ...globalSpanAttributes(user, app),
        'shipment.carrier': pick(rng, CARRIERS),
        'shipment.days_in_transit': randInt(rng, 0, 9),
        'shipment.status': pick(rng, [
          'label_created',
          'picked_up',
          'in_transit',
          'out_for_delivery',
          'delivered',
          'exception',
        ]),
      },
    },
    async () => sleep(randInt(rng, 60, 260)),
  );
}

/** buyer.return.initiate */
export async function buyerReturnInitiate(
  sentry: SentryLike,
  rng: Rng,
  user: UserProfile,
  app: AppContext,
  itemValueUsd: number,
): Promise<void> {
  await sentry.startSpan(
    {
      name: 'buyer.return.initiate',
      op: 'buyer.return.initiate',
      attributes: {
        ...globalSpanAttributes(user, app),
        'return.reason': pick(rng, RETURN_REASONS),
        'return.item_value_usd': itemValueUsd,
        'return.days_since_purchase': randInt(rng, 0, 30),
      },
    },
    async () => sleep(randInt(rng, 80, 260)),
  );
}

/**
 * Traffic simulator for the Sentry custom-spans demo.
 *
 * Spawns N concurrent "users" (mix of buyers + sellers, mix of platforms) that
 * each run a journey, emit the marketplace span schema, then loop. Designed to
 * populate the buyer/seller dashboards described in the README.
 *
 * Usage:
 *   SENTRY_DSN=... npm run simulate
 *   SENTRY_DSN=... npm run simulate -- --burst    # quick 60s burst
 */
import * as Sentry from '@sentry/node';
import {
  applyGlobalContext,
  type SentryLike,
  type UserProfile,
  type AppContext,
} from '../lib/sentry-context';
import { makeRng, pick, randInt, chance, opaqueId } from '../lib/random';
import { EXPERIMENT_VARIANTS, PLATFORMS, USER_SEGMENTS } from '../lib/fixtures';
import {
  buyerCartAdd,
  buyerCheckout,
  buyerListingView,
  buyerOfferMake,
  buyerReturnInitiate,
  buyerSearchQuery,
  buyerShippingTrack,
  sellerListingCreate,
  sellerOfferRespond,
  sellerPayoutProcess,
  sellerShippingLabel,
} from '../lib/journeys';

// ---------- Init Sentry ----------
const rawDsn = process.env.SENTRY_DSN_SIMULATOR || process.env.SENTRY_DSN;
if (!rawDsn || rawDsn.includes('<public_key>')) {
  console.error(
    '[simulate] SENTRY_DSN is not set. Copy .env.example to .env.local and paste a real DSN.',
  );
  process.exit(1);
}
const dsn: string = rawDsn;

Sentry.init({
  dsn,
  release: process.env.SENTRY_RELEASE || 'marketplace-web@demo',
  environment: process.env.SENTRY_ENVIRONMENT || 'demo',
  tracesSampleRate: 1.0,
  // The simulator runs standalone; opt into OTel-less mode for fewer deps.
  skipOpenTelemetrySetup: true,
});

// ---------- Config ----------
const args = new Set(process.argv.slice(2));
const BURST = args.has('--burst');
const CONCURRENCY = Number(process.env.SIM_CONCURRENCY || 8);
const DURATION_SEC = BURST ? 60 : Number(process.env.SIM_DURATION_SEC || 0);
const SEED = process.env.SIM_SEED || undefined;

const startedAt = Date.now();
let stopped = false;
process.on('SIGINT', () => {
  console.log('\n[simulate] SIGINT — draining...');
  stopped = true;
});

function shouldStop() {
  if (stopped) return true;
  if (DURATION_SEC > 0 && Date.now() - startedAt > DURATION_SEC * 1000) return true;
  return false;
}

// ---------- Synthetic user builder ----------
function makeUser(
  rng: ReturnType<typeof makeRng>,
): { user: UserProfile; app: AppContext } {
  const segment = pick(rng, USER_SEGMENTS.filter((s) => s !== 'staff'));
  return {
    user: {
      id: opaqueId(rng, 'usr_'),
      segment,
      tenureDays: randInt(rng, 1, 3200),
      country: 'US',
      // KYC verified is rarer for newer sellers → drives some payout failures.
      isKycVerified:
        segment === 'seller' || segment === 'both'
          ? chance(rng, 0.78)
          : chance(rng, 0.95),
      email: `${opaqueId(rng).slice(0, 8)}@example.test`,
    },
    app: {
      platform: pick(rng, PLATFORMS),
      release: process.env.SENTRY_RELEASE || 'marketplace-web@demo',
      environment: process.env.SENTRY_ENVIRONMENT || 'demo',
      locale: 'en-US',
      experimentVariant: pick(rng, EXPERIMENT_VARIANTS),
    },
  };
}

// ---------- Journey orchestration ----------
async function runBuyerJourney(
  rng: ReturnType<typeof makeRng>,
  user: UserProfile,
  app: AppContext,
): Promise<void> {
  // Classic funnel: search → view → (offer|cart) → checkout → (ship|return).
  const { resultsCount } = await buyerSearchQuery(
    Sentry as SentryLike,
    rng,
    user,
    app,
  );
  if (resultsCount === 0) return; // bounce

  // View 1–4 listings
  const viewCount = randInt(rng, 1, 4);
  let lastPrice = 0;
  for (let i = 0; i < viewCount; i++) {
    const { priceUsd } = await buyerListingView(
      Sentry as SentryLike,
      rng,
      user,
      app,
      { source: 'search' },
    );
    lastPrice = priceUsd;
  }

  // 30% make an offer instead of buying outright.
  if (chance(rng, 0.3)) {
    await buyerOfferMake(Sentry as SentryLike, rng, user, app, lastPrice);
    if (chance(rng, 0.6)) return; // offer pending — end of journey for now
  }

  // Add to cart + checkout (60% of viewers reach this point in the sim).
  if (!chance(rng, 0.6)) return;
  await buyerCartAdd(Sentry as SentryLike, rng, user, app, 1, lastPrice);

  const { confirmed } = await buyerCheckout(
    Sentry as SentryLike,
    rng,
    user,
    app,
    lastPrice,
  );

  if (confirmed) {
    // 70% track shipping at least once
    if (chance(rng, 0.7)) {
      await buyerShippingTrack(Sentry as SentryLike, rng, user, app);
    }
    // 6% initiate a return
    if (chance(rng, 0.06)) {
      await buyerReturnInitiate(Sentry as SentryLike, rng, user, app, lastPrice);
    }
  }
}

async function runSellerJourney(
  rng: ReturnType<typeof makeRng>,
  user: UserProfile,
  app: AppContext,
): Promise<void> {
  // Listing create → (respond to offers) → shipping label → payout.
  try {
    await sellerListingCreate(Sentry as SentryLike, rng, user, app);
  } catch {
    return; // already captured
  }
  // Respond to 1–3 offers
  const offerResponses = randInt(rng, 0, 3);
  for (let i = 0; i < offerResponses; i++) {
    await sellerOfferRespond(Sentry as SentryLike, rng, user, app);
  }
  // Shipping label + payout only for a subset (simulating sold items)
  if (chance(rng, 0.55)) {
    await sellerShippingLabel(Sentry as SentryLike, rng, user, app);
    try {
      await sellerPayoutProcess(Sentry as SentryLike, rng, user, app);
    } catch {
      // KYC-blocked or similar — captured already
    }
  }
}

async function runOneUserForever(workerId: number): Promise<void> {
  const rng = makeRng(SEED ? `${SEED}-${workerId}` : `${Date.now()}-${workerId}`);

  while (!shouldStop()) {
    const { user, app } = makeUser(rng);

    // Use Sentry's scope isolation so per-user tags don't leak across workers.
    await Sentry.withIsolationScope(async () => {
      applyGlobalContext(Sentry as SentryLike, user, app);

      try {
        if (user.segment === 'seller') {
          await runSellerJourney(rng, user, app);
        } else if (user.segment === 'both') {
          // "both" users drive the dashboard cohort that's most valuable.
          if (chance(rng, 0.5)) {
            await runSellerJourney(rng, user, app);
          } else {
            await runBuyerJourney(rng, user, app);
          }
        } else {
          await runBuyerJourney(rng, user, app);
        }
      } catch (err) {
        Sentry.captureException(err);
      }
    });

    // Short idle between journeys
    await new Promise((r) => setTimeout(r, randInt(rng, 50, 350)));
  }
}

async function main() {
  console.log(
    `[simulate] starting — concurrency=${CONCURRENCY} duration=${
      DURATION_SEC || 'forever'
    }s dsn=${dsn.slice(0, 40)}...`,
  );

  const workers = Array.from({ length: CONCURRENCY }, (_, i) =>
    runOneUserForever(i),
  );

  await Promise.all(workers);
  await Sentry.flush(5000);
  console.log('[simulate] done.');
}

main().catch(async (err) => {
  console.error('[simulate] fatal', err);
  await Sentry.flush(5000);
  process.exit(1);
});

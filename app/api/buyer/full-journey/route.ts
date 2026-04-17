import { NextRequest, NextResponse } from 'next/server';
import { buildContext, sentryClient } from '../../../../lib/api-helpers';
import {
  buyerCartAdd,
  buyerCheckout,
  buyerListingView,
  buyerSearchQuery,
  buyerShippingTrack,
} from '../../../../lib/journeys';

export async function POST(req: NextRequest) {
  const { rng, user, app } = buildContext(req);
  const { resultsCount } = await buyerSearchQuery(sentryClient, rng, user, app);
  const { priceUsd } = await buyerListingView(sentryClient, rng, user, app, {
    source: 'search',
  });
  await buyerCartAdd(sentryClient, rng, user, app, 1, priceUsd);
  const { confirmed } = await buyerCheckout(sentryClient, rng, user, app, priceUsd);
  if (confirmed) {
    await buyerShippingTrack(sentryClient, rng, user, app);
  }
  return NextResponse.json({ ok: true, resultsCount, priceUsd, confirmed });
}

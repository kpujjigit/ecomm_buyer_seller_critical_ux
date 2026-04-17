import { NextRequest, NextResponse } from 'next/server';
import { buildContext, sentryClient } from '../../../../lib/api-helpers';
import { buyerCartAdd, buyerCheckout, buyerListingView } from '../../../../lib/journeys';
import { randFloat } from '../../../../lib/random';

export async function POST(req: NextRequest) {
  const { rng, user, app } = buildContext(req);
  const forceDecline = req.nextUrl.searchParams.get('decline') === '1';

  // Simulate landing on a listing before checkout so the span tree has depth.
  const { priceUsd } = await buyerListingView(sentryClient, rng, user, app);
  await buyerCartAdd(sentryClient, rng, user, app, 1, priceUsd);
  const result = await buyerCheckout(sentryClient, rng, user, app, priceUsd, {
    forceDecline,
  });
  return NextResponse.json({ ok: true, priceUsd, ...result });
}

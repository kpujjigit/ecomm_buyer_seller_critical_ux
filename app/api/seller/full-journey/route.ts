import { NextRequest, NextResponse } from 'next/server';
import { buildContext, sentryClient } from '../../../../lib/api-helpers';
import {
  sellerListingCreate,
  sellerOfferRespond,
  sellerPayoutProcess,
  sellerShippingLabel,
} from '../../../../lib/journeys';

export async function POST(req: NextRequest) {
  const { rng, user, app } = buildContext(req, /* preferSeller */ true);
  try {
    const { listingId } = await sellerListingCreate(sentryClient, rng, user, app);
    await sellerOfferRespond(sentryClient, rng, user, app);
    await sellerShippingLabel(sentryClient, rng, user, app);
    await sellerPayoutProcess(sentryClient, rng, user, app);
    return NextResponse.json({ ok: true, listingId });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

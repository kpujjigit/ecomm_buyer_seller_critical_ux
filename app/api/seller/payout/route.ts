import { NextRequest, NextResponse } from 'next/server';
import { buildContext, sentryClient } from '../../../../lib/api-helpers';
import { sellerPayoutProcess } from '../../../../lib/journeys';

export async function POST(req: NextRequest) {
  const { rng, user, app } = buildContext(req, /* preferSeller */ true);

  // For the demo, allow forcing the KYC-blocked failure path.
  if (req.nextUrl.searchParams.get('kyc_blocked') === '1') {
    user.isKycVerified = false;
  }

  try {
    await sellerPayoutProcess(sentryClient, rng, user, app);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

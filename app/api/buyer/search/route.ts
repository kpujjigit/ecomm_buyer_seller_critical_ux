import { NextRequest, NextResponse } from 'next/server';
import { buildContext, sentryClient } from '../../../../lib/api-helpers';
import { buyerSearchQuery } from '../../../../lib/journeys';

export async function POST(req: NextRequest) {
  const { rng, user, app } = buildContext(req);
  const out = await buyerSearchQuery(sentryClient, rng, user, app);
  return NextResponse.json({ ok: true, ...out });
}

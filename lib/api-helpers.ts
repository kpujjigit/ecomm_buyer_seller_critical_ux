// Shared helpers for API routes — build a synthetic user/app context from the
// incoming request so every span carries the Section 3.1 global attributes.
import * as Sentry from '@sentry/nextjs';
import { NextRequest } from 'next/server';
import {
  applyGlobalContext,
  type SentryLike,
  type UserProfile,
  type AppContext,
} from './sentry-context';
import { EXPERIMENT_VARIANTS, PLATFORMS, USER_SEGMENTS } from './fixtures';
import { makeRng, opaqueId, pick, randInt, chance, type Rng } from './random';

export type RequestContext = {
  rng: Rng;
  user: UserProfile;
  app: AppContext;
};

export function buildContext(req: NextRequest, preferSeller = false): RequestContext {
  // Seed from a per-request UA+IP-ish fingerprint. Stable within a session but
  // varies across requests — good enough for demo telemetry.
  const ua = req.headers.get('user-agent') ?? '';
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  const rng = makeRng(`${ua}|${fwd}|${Date.now()}`);

  const segment = preferSeller
    ? pick(rng, ['seller', 'both'] as const)
    : pick(
        rng,
        USER_SEGMENTS.filter((s) => s !== 'staff'),
      );

  const platform = ua.toLowerCase().includes('iphone')
    ? 'ios'
    : ua.toLowerCase().includes('android')
    ? 'android'
    : pick(rng, PLATFORMS);

  const user: UserProfile = {
    id: opaqueId(rng, 'usr_'),
    segment,
    tenureDays: randInt(rng, 1, 3200),
    country: 'US',
    isKycVerified: chance(rng, 0.82),
  };

  const app: AppContext = {
    platform,
    release: process.env.SENTRY_RELEASE || 'marketplace-web@demo',
    environment: process.env.SENTRY_ENVIRONMENT || 'demo',
    locale: 'en-US',
    experimentVariant: pick(rng, EXPERIMENT_VARIANTS),
  };

  applyGlobalContext(Sentry as unknown as SentryLike, user, app);
  return { rng, user, app };
}

export const sentryClient = Sentry as unknown as SentryLike;

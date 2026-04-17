// Helpers that set the Section 3.1 global attributes (user.*, app.*, experiment.*)
// on the active Sentry scope. Called once per request (API route) or once per
// simulated user (simulator). Every span emitted after this will inherit them.
//
// This module is Sentry-SDK-agnostic: it accepts a `sentry` argument so it can
// be used with either `@sentry/nextjs` (API routes) or `@sentry/node` (simulator).

import type { Platform, UserSegment } from './fixtures';

// Minimal shape we rely on. Both @sentry/nextjs and @sentry/node satisfy this.
export type SentryLike = {
  setUser: (user: Record<string, unknown> | null) => void;
  setTag: (key: string, value: string | number | boolean) => void;
  setTags: (tags: Record<string, string | number | boolean>) => void;
  setContext: (name: string, context: Record<string, unknown> | null) => void;
  startSpan: <T>(
    options: {
      name: string;
      op?: string;
      attributes?: Record<string, unknown>;
      forceTransaction?: boolean;
    },
    callback: (span: SpanLike) => Promise<T> | T,
  ) => Promise<T>;
  captureException: (err: unknown, hint?: unknown) => string;
  captureMessage?: (msg: string) => string;
  withScope: (fn: (scope: unknown) => void) => void;
};

export type SpanLike = {
  setAttribute: (key: string, value: unknown) => void;
  setStatus?: (status: { code: number; message?: string }) => void;
  end?: () => void;
} | undefined;

export type UserProfile = {
  id: string;
  segment: UserSegment;
  tenureDays: number;
  country: string;
  isKycVerified: boolean;
  email?: string;
};

export type AppContext = {
  platform: Platform;
  release: string;
  environment: string;
  locale: string;
  experimentVariant?: string;
};

/**
 * Attach the Section 3.1 global attributes to the active Sentry scope.
 * Tags set here appear on every span + event for the remainder of the scope.
 */
export function applyGlobalContext(
  sentry: SentryLike,
  user: UserProfile,
  app: AppContext,
): void {
  sentry.setUser({
    id: user.id,
    email: user.email,
    segment: user.segment,
  });

  sentry.setTags({
    // --- user.* ---
    'user.id': user.id,
    'user.segment': user.segment,
    'user.tenure_days': user.tenureDays,
    'user.country': user.country,
    'user.is_kyc_verified': user.isKycVerified,
    // --- app.* ---
    'app.platform': app.platform,
    'app.release': app.release,
    'app.environment': app.environment,
    'app.locale': app.locale,
    // --- experiment ---
    ...(app.experimentVariant
      ? { 'experiment.variant': app.experimentVariant }
      : {}),
  });

  // A richer context object is useful for the Issue page "Additional Data" tab.
  sentry.setContext('marketplace_user', {
    id: user.id,
    segment: user.segment,
    tenure_days: user.tenureDays,
    country: user.country,
    is_kyc_verified: user.isKycVerified,
  });
  sentry.setContext('marketplace_app', {
    platform: app.platform,
    release: app.release,
    environment: app.environment,
    locale: app.locale,
    experiment_variant: app.experimentVariant ?? null,
  });
}

/** Convenience: merge the global attrs into every span's attribute map so they
 *  also flow into the spans-metrics extraction pipeline (tags alone don't). */
export function globalSpanAttributes(
  user: UserProfile,
  app: AppContext,
): Record<string, unknown> {
  return {
    'user.id': user.id,
    'user.segment': user.segment,
    'user.tenure_days': user.tenureDays,
    'user.country': user.country,
    'user.is_kyc_verified': user.isKycVerified,
    'app.platform': app.platform,
    'app.release': app.release,
    'app.environment': app.environment,
    'app.locale': app.locale,
    ...(app.experimentVariant
      ? { 'experiment.variant': app.experimentVariant }
      : {}),
  };
}

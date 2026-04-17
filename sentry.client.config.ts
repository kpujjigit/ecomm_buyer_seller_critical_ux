// Sentry client init — runs in the browser.
//
// NOTE on replay sampling:
// Many ecommerce teams default to replaysSessionSampleRate ≈ 1.0 and blow past
// their replay quota as a result. This config demonstrates the recommended
// journey-event capture pattern:
//   * replaysSessionSampleRate = 0.01 (1% ambient)
//   * replaysOnErrorSampleRate = 1.0  (always capture when an error happens)
//   * Manually captureReplay() at journey events (see lib/journeys.ts).
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
  release: process.env.SENTRY_RELEASE,
  environment: process.env.SENTRY_ENVIRONMENT || 'demo',

  // Tracing — 100% in the demo so every span is visible. In production you
  // would tune this per `transaction.op` via dynamic sampling rules.
  tracesSampleRate: 1.0,

  // Replay — the bleed-stop configuration from Section 4 of the value framework.
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Tag the session so dashboards can split web vs mobile.
  initialScope: {
    tags: {
      'app.platform': 'web',
    },
  },
});

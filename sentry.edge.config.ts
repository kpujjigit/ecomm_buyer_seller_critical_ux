// Sentry edge init — runs on Vercel Edge / middleware. Intentionally minimal.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.SENTRY_RELEASE,
  environment: process.env.SENTRY_ENVIRONMENT || 'demo',
  tracesSampleRate: 1.0,
});

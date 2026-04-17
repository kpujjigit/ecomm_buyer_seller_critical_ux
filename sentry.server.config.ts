// Sentry server init — runs in the Next.js Node runtime (API routes, SSR).
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.SENTRY_RELEASE,
  environment: process.env.SENTRY_ENVIRONMENT || 'demo',
  tracesSampleRate: 1.0,
  // Every server span gets a platform tag so buyer/seller dashboards can split
  // web SSR from edge/worker spans if those are ever added.
  initialScope: {
    tags: {
      'app.platform': 'web',
      'app.runtime': 'nextjs-server',
    },
  },
});

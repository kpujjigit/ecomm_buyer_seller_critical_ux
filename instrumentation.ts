// Next.js calls register() once at server boot. This is the canonical place to
// wire Sentry's server + edge runtimes per @sentry/nextjs v8+ guidance.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// onRequestError is the v8+ hook for capturing server-side errors with full
// request context attached to the event.
export { captureRequestError as onRequestError } from '@sentry/nextjs';

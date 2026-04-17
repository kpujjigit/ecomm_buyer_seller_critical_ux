/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  reactStrictMode: true,
  // Release identifier makes its way onto every event as `release`
  // and is also mirrored onto spans as `app.release` via lib/sentry-context.
  env: {
    SENTRY_RELEASE:
      process.env.SENTRY_RELEASE ||
      `marketplace-web@${new Date().toISOString().slice(0, 10)}-demo`,
  },
};

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Upload source maps only if an auth token is present.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  hideSourceMaps: true,
  disableLogger: true,
});

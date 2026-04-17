import type { ReactNode } from 'react';

export const metadata = {
  title: 'Sentry Custom Spans Demo',
  description:
    'Sample Next.js app demonstrating Sentry custom span attributes for C2C marketplace buyer/seller journeys.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          maxWidth: 960,
          margin: '32px auto',
          padding: '0 16px',
          color: '#1d2328',
        }}
      >
        <header style={{ borderBottom: '1px solid #eee', paddingBottom: 16 }}>
          <strong>Sentry Custom Spans Demo</strong>
          <nav style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <a href="/">Home</a>
            <a href="/buyer">Buyer</a>
            <a href="/seller">Seller</a>
          </nav>
        </header>
        <main style={{ paddingTop: 24 }}>{children}</main>
      </body>
    </html>
  );
}

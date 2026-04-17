'use client';

import { useState } from 'react';

type Result = { status: 'ok' | 'err'; data?: unknown; error?: string };

export default function SellerPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const run = async (path: string, label: string) => {
    setPending(label);
    setResult(null);
    try {
      const res = await fetch(path, { method: 'POST' });
      const data = await res.json();
      setResult({ status: res.ok ? 'ok' : 'err', data });
    } catch (e) {
      setResult({ status: 'err', error: String(e) });
    } finally {
      setPending(null);
    }
  };

  return (
    <div>
      <h1>Seller Journey</h1>
      <p>
        Each button calls a server API route that wraps the journey in a
        Sentry transaction.
      </p>

      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <button onClick={() => run('/api/seller/full-journey', 'full')} disabled={!!pending}>
          {pending === 'full' ? 'running...' : 'Run full journey (create → photos → payout)'}
        </button>
        <button
          onClick={() => run('/api/seller/listing', 'listing')}
          disabled={!!pending}
        >
          Emit <code>seller.listing.create</code>
        </button>
        <button
          onClick={() => run('/api/seller/payout?kyc_blocked=1', 'payout')}
          disabled={!!pending}
        >
          Emit <code>seller.payout.process</code> with KYC block error
        </button>
      </div>

      {result && (
        <pre
          style={{
            marginTop: 24,
            background: '#f6f8fa',
            padding: 12,
            borderRadius: 6,
            fontSize: 12,
            overflow: 'auto',
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

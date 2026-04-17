'use client';

import { useState } from 'react';

type Result = { status: 'ok' | 'err'; data?: unknown; error?: string };

export default function BuyerPage() {
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
      <h1>Buyer Journey</h1>
      <p>
        Each button calls a server API route that wraps the journey in a
        Sentry transaction. Open your Sentry <em>Performance</em> page after
        clicking to see the span tree.
      </p>

      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <button onClick={() => run('/api/buyer/full-journey', 'full')} disabled={!!pending}>
          {pending === 'full' ? 'running...' : 'Run full journey (search → view → checkout)'}
        </button>
        <button onClick={() => run('/api/buyer/search', 'search')} disabled={!!pending}>
          Emit <code>buyer.search.query</code>
        </button>
        <button
          onClick={() => run('/api/buyer/checkout?decline=1', 'decline')}
          disabled={!!pending}
        >
          Emit <code>buyer.checkout.*</code> with forced payment decline
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

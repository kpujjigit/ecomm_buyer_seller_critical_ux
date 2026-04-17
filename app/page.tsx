export default function Home() {
  return (
    <div>
      <h1>Sentry Custom Spans Demo</h1>
      <p>
        A minimal Next.js app that emits a rich, e-commerce-shaped custom span
        attribute schema to Sentry. Every click below triggers an API route
        that wraps the journey in a Sentry transaction with buyer/seller
        attributes attached (payment method, listing category, KYC status,
        platform, release, A/B variant, and more).
      </p>
      <p>
        For dashboard-populating volumes, run the traffic simulator instead:{' '}
        <code>npm run simulate</code>.
      </p>

      <h2 style={{ marginTop: 32 }}>Demo journeys</h2>
      <ul>
        <li>
          <a href="/buyer">Buyer journey</a> — search → view → checkout (with
          realistic payment decline rate)
        </li>
        <li>
          <a href="/seller">Seller journey</a> — create listing → upload photos
          → pricing → payout
        </li>
      </ul>

      <h2 style={{ marginTop: 32 }}>Span ops emitted</h2>
      <p style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 13 }}>
        buyer.search.query, buyer.listing.view, buyer.offer.make,
        buyer.cart.add, buyer.checkout.start, buyer.checkout.payment,
        buyer.checkout.confirm, buyer.shipping.track, buyer.return.initiate,
        seller.listing.create, seller.photo.upload, seller.pricing.suggest,
        seller.offer.respond, seller.shipping.label, seller.payout.process
      </p>
    </div>
  );
}

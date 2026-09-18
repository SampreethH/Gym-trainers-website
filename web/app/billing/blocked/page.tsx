import Link from "next/link";

export default function BillingBlocked() {
  return (
    <div className="paywall">
      <div>
        <p className="eyebrow">Subscription inactive</p>
        <h1 className="serif" style={{ fontSize: 48 }}>Access revoked.</h1>
        <p className="lede" style={{ margin: "0 auto 24px" }}>
          Trainer features require an active Studio, Atelier, or Maison plan. Payment failure
          or cancellation closes the command center immediately.
        </p>
        <p className="fine">Demo: ask an admin to reinstate Vance Studio, or sign in as trainer@elevate.demo</p>
        <div className="cta-row" style={{ justifyContent: "center" }}>
          <Link className="primary" href="/enter">
            Return to entry
          </Link>
        </div>
      </div>
    </div>
  );
}

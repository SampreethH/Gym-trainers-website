"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const KineticScene = dynamic(
  () => import("@/components/kinetic-scene").then((m) => m.KineticScene),
  { ssr: false, loading: () => <div className="hero-fallback" /> },
);

export default function LandingPage() {
  return (
    <section className="hero">
      <div className="hero-canvas">
        <KineticScene />
      </div>
      <div className="hero-copy">
        <div className="brand">
          <span className="mark">É</span>
          Elevate OS
        </div>
        <div>
          <p className="eyebrow">Iron in motion</p>
          <h1>Load the bar. Keep the hour.</h1>
          <p className="lede">
            A weightlifting studio in the browser. Sign in with your issued email —
            the platform opens the floor that belongs to that account.
          </p>
          <div className="cta-row">
            <Link className="primary" href="/enter">
              Enter the studio
            </Link>
          </div>
        </div>
        <p className="fine">Desktop and tablet · Live session logging · Subscription-gated coaching</p>
      </div>
    </section>
  );
}

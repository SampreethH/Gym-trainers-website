"use client";

import { elevate } from "@/lib/client";
import { homeFor } from "@/lib/routes";
import type { Role } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function EnterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await elevate<{
        user: { role: Role };
        tenant: { subscriptionStatus: string } | null;
      }>("login", { email, password });
      if (
        data.user.role === "trainer" &&
        data.tenant &&
        !["active", "trialing"].includes(data.tenant.subscriptionStatus)
      ) {
        router.push("/billing/blocked");
        return;
      }
      router.push(homeFor(data.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="enter">
      <div className="enter-visual">
        <div className="lift-mark" aria-hidden>
          <span className="plate" />
          <span className="bar" />
          <span className="plate right" />
        </div>
        <p className="eyebrow">The hour under the bar</p>
        <h1>Your credentials open the studio that belongs to you.</h1>
        <p className="lede">Sign in with the email issued to your account. The floor is assigned from that identity.</p>
      </div>
      <div className="auth-card">
        <p className="eyebrow">Secure entry</p>
        <h2 className="serif" style={{ fontSize: 32, margin: "8px 0" }}>Welcome back.</h2>
        <form onSubmit={submit}>
          <label className="form-field">
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" required />
          </label>
          <label className="form-field">
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required />
          </label>
          {error ? <p className="danger">{error}</p> : null}
          <button className="primary full" type="submit" disabled={busy}>
            {busy ? "Checking…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

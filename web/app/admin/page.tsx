"use client";

import { AppShell, Toast } from "@/components/app-shell";
import { elevate } from "@/lib/client";
import { useEffect, useState } from "react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  goal?: string;
};

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tenants, setTenants] = useState<{ id: string; name: string; subscriptionStatus: string; tier: string }[]>([]);
  const [byRole, setByRole] = useState<Record<string, number>>({});
  const [subs, setSubs] = useState({ active: 0, revoked: 0 });
  const [audit, setAudit] = useState<{ id: string; at: string; action: string; detail: string }[]>([]);
  const [revenue, setRevenue] = useState<{ month: string; amount: number }[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [reg, setReg] = useState({
    name: "",
    email: "",
    role: "gt_client",
    goal: "fat_loss",
    weightKg: "70",
    heightCm: "170",
  });

  async function load() {
    const data = await elevate<{
      users: UserRow[];
      tenants: { id: string; name: string; subscriptionStatus: string; tier: string }[];
      byRole: Record<string, number>;
      subs: { active: number; revoked: number };
      audit: { id: string; at: string; action: string; detail: string }[];
      revenue: { month: string; amount: number }[];
    }>("admin.overview");
    setUsers(data.users);
    setTenants(data.tenants);
    setByRole(data.byRole);
    setSubs(data.subs);
    setAudit(data.audit);
    setRevenue(data.revenue);
  }

  useEffect(() => {
    load().catch((err) => setToast(err.message));
  }, []);

  const maxRev = Math.max(...revenue.map((r) => r.amount), 1);

  return (
    <AppShell title="Platform control" eyebrow="Admin">
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="metric">
          <span>GT clients</span>
          <strong>{byRole.gt_client ?? 0}</strong>
          <span>active</span>
        </div>
        <div className="metric">
          <span>PT clients</span>
          <strong>{byRole.pt_client ?? 0}</strong>
          <span>active</span>
        </div>
        <div className="metric">
          <span>Trainers paying</span>
          <strong>{subs.active}</strong>
          <span>{subs.revoked} revoked</span>
        </div>
        <div className="metric">
          <span>September MRR (demo)</span>
          <strong>${revenue.at(-1)?.amount ?? 0}</strong>
          <span>tracked</span>
        </div>
      </div>
      <div className="panel" style={{ marginBottom: 20 }}>
        <p className="eyebrow">Revenue</p>
        <div className="chart">
          {revenue.map((r) => (
            <div key={r.month} className="bar" style={{ height: `${(r.amount / maxRev) * 100}%` }} title={`${r.month} $${r.amount}`} />
          ))}
        </div>
      </div>
      <div className="panel" style={{ marginBottom: 20 }}>
        <p className="eyebrow">Register a client</p>
        <form
          className="reg-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            await elevate("admin.register", reg);
            setReg({ ...reg, name: "", email: "" });
            await load();
            setToast("Client issued");
          }}
        >
          <label className="form-field">
            Name
            <input value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} required />
          </label>
          <label className="form-field">
            Email
            <input type="email" value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} required />
          </label>
          <label className="form-field">
            Studio
            <select value={reg.role} onChange={(e) => setReg({ ...reg, role: e.target.value })}>
              <option value="gt_client">Floor client</option>
              <option value="pt_client">Studio client</option>
            </select>
          </label>
          <label className="form-field">
            Objective
            <select value={reg.goal} onChange={(e) => setReg({ ...reg, goal: e.target.value })} required>
              <option value="fat_loss">Fat loss</option>
              <option value="weight_gain">Weight gain</option>
              <option value="shredding">Shredding</option>
            </select>
          </label>
          <button className="primary" type="submit">
            Issue account
          </button>
        </form>
        <p className="fine">Temporary password is elevate-demo. Objective is required before the trainer can place them on a list.</p>
      </div>
      <div className="panel" style={{ marginBottom: 20 }}>
        <p className="eyebrow">Accounts</p>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Studio</th>
              <th>Objective</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>
                  {u.role === "gt_client" || u.role === "pt_client" ? (
                    <select
                      value={u.goal ?? "fat_loss"}
                      onChange={async (e) => {
                        await elevate("admin.user", { userId: u.id, goal: e.target.value });
                        await load();
                      }}
                    >
                      <option value="fat_loss">Fat loss</option>
                      <option value="weight_gain">Weight gain</option>
                      <option value="shredding">Shredding</option>
                    </select>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{u.status}</td>
                <td>
                  <button
                    className="ghost"
                    type="button"
                    onClick={async () => {
                      await elevate("admin.user", {
                        userId: u.id,
                        status: u.status === "active" ? "suspended" : "active",
                      });
                      await load();
                      setToast("Account updated");
                    }}
                  >
                    {u.status === "active" ? "Suspend" : "Restore"}
                  </button>
                  <button
                    className="ghost"
                    type="button"
                    onClick={async () => {
                      await elevate("admin.recovery", { userId: u.id });
                      setToast("Recovery email queued");
                    }}
                  >
                    Recover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel" style={{ marginBottom: 20 }}>
        <p className="eyebrow">Trainer subscriptions</p>
        {tenants.map((t) => (
          <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <span>
              {t.name} · {t.tier} · {t.subscriptionStatus}
            </span>
            <button
              className="ghost"
              type="button"
              onClick={async () => {
                await elevate("admin.subscription", {
                  tenantId: t.id,
                  status: t.subscriptionStatus === "active" ? "canceled" : "active",
                });
                await load();
                setToast("Access updated immediately");
              }}
            >
              {t.subscriptionStatus === "active" ? "Revoke access" : "Reinstate"}
            </button>
          </div>
        ))}
      </div>
      <div className="panel">
        <p className="eyebrow">Audit</p>
        <ul>
          {audit.map((a) => (
            <li key={a.id}>
              {a.action} — {a.detail}
            </li>
          ))}
        </ul>
      </div>
      <Toast message={toast} />
    </AppShell>
  );
}

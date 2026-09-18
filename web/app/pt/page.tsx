"use client";

import { AppShell, Toast } from "@/components/app-shell";
import { Confetti, LeaderBoards } from "@/components/leader-boards";
import { CertificateCard, WorkoutBoard } from "@/components/workout-board";
import { elevate } from "@/lib/client";
import { useEffect, useState } from "react";

type SetRow = {
  id: string;
  exerciseId: string;
  setNumber: number;
  reps: string;
  weightKg: string;
  restSeconds: string;
  notes: string;
  completedAt: string | null;
  exercise?: {
    name: string;
    primaryMuscle: string;
    secondary: string[];
    cues: string;
    equipment: string;
  } | null;
};

export default function PtPage() {
  const [tab, setTab] = useState<"strength" | "cardio" | "book" | "profile">("strength");
  const [data, setData] = useState<{
    bmi: number;
    profile: { name: string; weightKg: number; heightCm: number; bodyFatPct: number };
    metrics: { recordedAt: string; weightKg: number; bmi: number; bodyFatPct: number }[];
    bookings: { id: string; startAt: string; status: string; rescheduledFromId: string | null }[];
    images: { id: string; kind: string; dataUrl: string }[];
    programs: { kind: string; trainerLocked: boolean }[];
    leaderboard: { name: string; kcal: number; points: number; gained: number }[];
  } | null>(null);
  const [session, setSession] = useState<{ id: string; sets: SetRow[]; status: string } | null>(null);
  const [cert, setCert] = useState<Parameters<typeof CertificateCard>[0]["certificate"] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const [form, setForm] = useState({ weightKg: "", heightCm: "", bodyFatPct: "" });

  async function load() {
    const dash = await elevate<{
      bmi: number;
      profile: { name: string; weightKg: number; heightCm: number; bodyFatPct: number };
      metrics: { recordedAt: string; weightKg: number; bmi: number; bodyFatPct: number }[];
      bookings: { id: string; startAt: string; status: string; rescheduledFromId: string | null }[];
      images: { id: string; kind: string; dataUrl: string }[];
      programs: { kind: string; trainerLocked: boolean }[];
      leaderboard: { name: string; kcal: number; points: number; gained: number }[];
    }>("pt.dashboard");
    setData(dash);
    setForm({
      weightKg: String(dash.profile.weightKg),
      heightCm: String(dash.profile.heightCm),
      bodyFatPct: String(dash.profile.bodyFatPct),
    });
  }

  useEffect(() => {
    load().catch((err) => setToast(err.message));
  }, []);

  async function openKind(kind: "strength" | "cardio") {
    setTab(kind);
    const result = await elevate<{ session: { id: string; sets: SetRow[]; status: string } }>("session.open", {
      programType: "pt",
      kind,
      date: new Date().toLocaleDateString("en-CA"),
    });
    setSession(result.session);
    setCert(null);
  }

  function patchLocal(setId: string, patch: Partial<SetRow>) {
    setSession((s) =>
      s ? { ...s, sets: s.sets.map((row) => (row.id === setId ? { ...row, ...patch } : row)) } : s,
    );
  }

  async function completeSet(row: SetRow) {
    try {
      const result = await elevate<{ session: { id: string; sets: SetRow[]; status: string } }>("set.complete", {
        sessionId: session?.id,
        setId: row.id,
        reps: row.reps,
        weightKg: row.weightKg,
        restSeconds: row.restSeconds,
        notes: row.notes,
      });
      setSession(result.session);
      setBurst((n) => n + 1);
      setToast("Set counted");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Blocked");
    }
  }

  async function finish() {
    try {
      const result = await elevate<{
        certificate: Parameters<typeof CertificateCard>[0]["certificate"];
        session: { id: string; sets: SetRow[]; status: string };
      }>("session.complete", { sessionId: session?.id });
      setSession(result.session);
      setCert(result.certificate);
      setBurst((n) => n + 1);
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Finish blocked");
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    await elevate("pt.profile", form);
    await load();
    setToast("Profile saved · BMI recalculated");
  }

  async function book() {
    const start = new Date();
    start.setDate(start.getDate() + 3);
    start.setHours(18, 0, 0, 0);
    const end = new Date(start.getTime() + 3600000);
    await elevate("pt.book", { startAt: start.toISOString(), endAt: end.toISOString() });
    await load();
    setToast("Slot booked with Maya Singh");
  }

  const maxW = Math.max(...(data?.metrics.map((m) => m.weightKg) ?? [1]));

  return (
    <AppShell title={data?.profile.name ?? "Personal training"} eyebrow="PT studio">
      <div className="role-tabs" style={{ marginBottom: 20 }}>
        {(["strength", "cardio", "book", "profile"] as const).map((id) => (
          <button key={id} className={`role-tab ${tab === id ? "active" : ""}`} type="button" onClick={() => (id === "strength" || id === "cardio" ? openKind(id) : setTab(id))}>
            {id}
          </button>
        ))}
      </div>
      <LeaderBoards rows={data?.leaderboard ?? []} />
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="metric">
          <span>BMI</span>
          <strong>{data?.bmi ?? "—"}</strong>
          <span>calculated</span>
        </div>
        <div className="metric">
          <span>Weight</span>
          <strong>{data?.profile.weightKg ?? "—"}</strong>
          <span>kg</span>
        </div>
        <div className="metric">
          <span>Body fat</span>
          <strong>{data?.profile.bodyFatPct ?? "—"}%</strong>
          <span>logged</span>
        </div>
        <div className="metric">
          <span>No-show moves</span>
          <strong>{data?.bookings.filter((b) => b.status === "no_show").length ?? 0}</strong>
          <span>auto-rescheduled</span>
        </div>
      </div>

      {tab === "book" ? (
        <div className="panel">
          <p className="eyebrow">Trainer calendar</p>
          <h3>Book Maya Singh</h3>
          <button className="primary" type="button" onClick={book} style={{ margin: "12px 0" }}>
            Book +3 days · 18:00
          </button>
          <ul>
            {data?.bookings.map((b) => (
              <li key={b.id}>
                {new Date(b.startAt).toLocaleString()} · {b.status}
                {b.rescheduledFromId ? " · moved after no-show" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "profile" ? (
        <div className="grid-2">
          <form className="panel" onSubmit={saveProfile}>
            <p className="eyebrow">Metrics</p>
            <label className="form-field">
              Weight (kg)
              <input value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
            </label>
            <label className="form-field">
              Height (cm)
              <input value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} />
            </label>
            <label className="form-field">
              Body fat %
              <input value={form.bodyFatPct} onChange={(e) => setForm({ ...form, bodyFatPct: e.target.value })} />
            </label>
            <button className="primary" type="submit">
              Save
            </button>
          </form>
          <div className="panel">
            <p className="eyebrow">Weight over time</p>
            <div className="chart">
              {data?.metrics.map((m) => (
                <div key={m.recordedAt} className="bar" style={{ height: `${(m.weightKg / maxW) * 100}%` }} title={`${m.recordedAt}: ${m.weightKg}`} />
              ))}
            </div>
            <p className="fine">BMI and body fat travel with each save.</p>
          </div>
        </div>
      ) : null}

      {(tab === "strength" || tab === "cardio") && session ? (
        <>
          <p className="fine">Trainer-preloaded · {data?.programs.find((p) => p.kind === tab)?.trainerLocked ? "locked" : "client-editable later"}</p>
          <WorkoutBoard sets={session.sets} onChange={patchLocal} onCompleteSet={completeSet} />
          <button className="primary" type="button" onClick={finish} style={{ marginTop: 16 }}>
            Finish workout
          </button>
        </>
      ) : null}
      {cert ? <div style={{ marginTop: 24 }}><CertificateCard certificate={cert} /></div> : null}
      <Toast message={toast} />
      <Confetti fire={burst} />
    </AppShell>
  );
}

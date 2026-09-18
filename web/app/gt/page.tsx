"use client";

import { AppShell, Toast } from "@/components/app-shell";
import { Confetti, LeaderBoards } from "@/components/leader-boards";
import { CertificateCard, WorkoutBoard } from "@/components/workout-board";
import { elevate } from "@/lib/client";
import { useEffect, useMemo, useState } from "react";

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

function monthDays(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    const month = String(m).padStart(2, "0");
    return `${y}-${month}-${day}`;
  });
}

function localISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function GtPage() {
  const [dates, setDates] = useState<string[]>([]);
  const [selected, setSelected] = useState(localISO());
  const [plan, setPlan] = useState<{ groups: { muscle: string; exercises: { name: string }[] }[] } | null>(null);
  const [session, setSession] = useState<{ id: string; sets: SetRow[]; status: string } | null>(null);
  const [cert, setCert] = useState<Parameters<typeof CertificateCard>[0]["certificate"] | null>(null);
  const [board, setBoard] = useState<{ name: string; kcal: number; points: number; gained: number }[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);

  const days = useMemo(() => monthDays(selected), [selected]);

  async function loadCalendar() {
    const data = await elevate<{ dates: string[]; leaderboard: { name: string; kcal: number; points: number; gained: number }[] }>("gt.calendar");
    setDates(data.dates);
    setBoard(data.leaderboard);
  }

  async function loadPlan(date: string) {
    setSelected(date);
    setSession(null);
    setCert(null);
    try {
      const data = await elevate<{ plan: { groups: { muscle: string; exercises: { name: string }[] }[] } }>("gt.plan", { date });
      setPlan(data.plan);
      setError(null);
    } catch (err) {
      setPlan(null);
      setError(err instanceof Error ? err.message : "No plan");
    }
  }

  useEffect(() => {
    loadCalendar().then(() => loadPlan(selected)).catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    const data = await elevate<{ session: { id: string; sets: SetRow[]; status: string } }>("session.open", {
      programType: "gt",
      date: selected,
    });
    setSession(data.session);
  }

  function patchLocal(setId: string, patch: Partial<SetRow>) {
    setSession((s) =>
      s ? { ...s, sets: s.sets.map((row) => (row.id === setId ? { ...row, ...patch } : row)) } : s,
    );
  }

  async function completeSet(row: SetRow) {
    try {
      const data = await elevate<{ session: { id: string; sets: SetRow[]; status: string } }>("set.complete", {
        sessionId: session?.id,
        setId: row.id,
        reps: row.reps,
        weightKg: row.weightKg,
        restSeconds: row.restSeconds,
        notes: row.notes,
      });
      setSession(data.session);
      setBurst((n) => n + 1);
      setToast("Set counted");
      setTimeout(() => setToast(null), 1600);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not complete set");
    }
  }

  async function finish() {
    try {
      const data = await elevate<{
        certificate: Parameters<typeof CertificateCard>[0]["certificate"];
        session: { id: string; sets: SetRow[]; status: string };
      }>("session.complete", { sessionId: session?.id });
      setSession(data.session);
      setCert(data.certificate);
      setBurst((n) => n + 1);
      await loadCalendar();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Finish blocked");
    }
  }

  return (
    <AppShell
      title="Group floor"
      eyebrow="General training"
      nav={[{ href: "/gt", label: "Calendar" }]}
    >
      <LeaderBoards rows={board} />
      <div className="panel" style={{ marginBottom: 20 }}>
        <p className="eyebrow">Select a training date</p>
        <div className="calendar" style={{ marginTop: 12 }}>
          {days.map((day) => (
            <button
              key={day}
              type="button"
              className={`day ${selected === day ? "active" : ""} ${dates.includes(day) ? "has" : ""}`}
              onClick={() => loadPlan(day)}
            >
              <em>{day.slice(8)}</em>
              {dates.includes(day) ? "Plan" : ""}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="muted">{error}</p> : null}
      {plan && !session ? (
        <div className="panel">
          <p className="eyebrow">Published plan · 5 variations per muscle</p>
          {plan.groups.map((g) => (
            <div key={g.muscle} style={{ marginTop: 16 }}>
              <h3>{g.muscle}</h3>
              <ol>
                {g.exercises.map((ex) => (
                  <li key={ex.name}>{ex.name}</li>
                ))}
              </ol>
            </div>
          ))}
          <button className="primary" type="button" onClick={start}>
            Open session
          </button>
        </div>
      ) : null}
      {session ? (
        <>
          <WorkoutBoard sets={session.sets} onChange={patchLocal} onCompleteSet={completeSet} />
          <div style={{ marginTop: 20 }}>
            <button className="primary" type="button" onClick={finish} disabled={session.status === "completed"}>
              Finish workout
            </button>
          </div>
        </>
      ) : null}
      {cert ? (
        <div style={{ marginTop: 24 }}>
          <CertificateCard certificate={cert} />
        </div>
      ) : null}
      <Toast message={toast} />
      <Confetti fire={burst} />
    </AppShell>
  );
}

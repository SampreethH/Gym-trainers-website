"use client";

import { AppShell, Toast } from "@/components/app-shell";
import { Confetti } from "@/components/leader-boards";
import { elevate } from "@/lib/client";
import { goalLabel } from "@/lib/stats";
import type { TrainingGoal } from "@/lib/types";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  name: string;
  program: string;
  lastWorkout: string;
  todayStatus: string;
  weightKg: number;
  bmi: number;
  bodyFatPct: number;
  noshows: number;
  goal: TrainingGoal;
  kcal: number;
  points: number;
};

const EMPTY_GROUP = { muscle: "Chest", exerciseIds: ["ex_bench", "ex_incline", "ex_fly", "ex_pushup", "ex_dip"] };

export default function TrainerPage() {
  const [floor, setFloor] = useState<Row[]>([]);
  const [studio, setStudio] = useState<Row[]>([]);
  const [goals, setGoals] = useState<Record<TrainingGoal, Row[]>>({
    fat_loss: [],
    weight_gain: [],
    shredding: [],
  });
  const [live, setLive] = useState<Row[]>([]);
  const [bookings, setBookings] = useState<{ id: string; clientId: string; startAt: string; status: string }[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [message, setMessage] = useState("");
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [muscle, setMuscle] = useState("Chest");
  const [ids, setIds] = useState(EMPTY_GROUP.exerciseIds.join(","));
  const [toast, setToast] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);

  async function load() {
    try {
      const data = await elevate<{
        rows: Row[];
        floor: Row[];
        studio: Row[];
        goals: Record<TrainingGoal, Row[]>;
        live: Row[];
        bookings: { id: string; clientId: string; startAt: string; status: string }[];
      }>("trainer.board");
      setFloor(data.floor);
      setStudio(data.studio);
      setGoals(data.goals);
      setLive(data.live);
      setBookings(data.bookings);
      setSelected((prev) => data.studio.find((r) => r.id === prev?.id) ?? data.studio[0] ?? null);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 402) window.location.href = "/billing/blocked";
      setToast(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await elevate("trainer.message", { toId: selected.id, body: message });
    setMessage("");
    setToast(`Note sent to ${selected.name}`);
  }

  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    const exerciseIds = ids.split(",").map((s) => s.trim()).filter(Boolean);
    await elevate("trainer.plan.save", {
      date,
      groups: [{ muscle, exerciseIds }],
    });
    setBurst((n) => n + 1);
    setToast("Plan published");
  }

  return (
    <AppShell title="Atelier Singh" eyebrow="Trainer command">
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="metric">
          <span>Studio live</span>
          <strong>{live.filter((r) => r.program === "PT").length}</strong>
          <span>in session</span>
        </div>
        <div className="metric">
          <span>Studio roster</span>
          <strong>{studio.length}</strong>
          <span>personal</span>
        </div>
        <div className="metric">
          <span>Floor roster</span>
          <strong>{floor.length}</strong>
          <span>group</span>
        </div>
        <div className="metric">
          <span>No-shows</span>
          <strong>{bookings.filter((b) => b.status === "no_show").length}</strong>
          <span>auto-moved</span>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 20 }}>
        {(["fat_loss", "weight_gain", "shredding"] as const).map((goal) => (
          <div key={goal} className="panel">
            <p className="eyebrow">{goalLabel(goal)}</p>
            <div className="client-stack">
              {goals[goal]
                .slice()
                .sort((a, b) => Number(b.program === "PT") - Number(a.program === "PT"))
                .map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className={`client-chip ${row.program === "PT" ? "is-pt" : "is-gt"} ${selected?.id === row.id ? "is-on" : ""}`}
                    onClick={() => setSelected(row)}
                  >
                    <strong>{row.name}</strong>
                    <small>
                      {row.program === "PT" ? "Studio" : "Floor"} · {row.todayStatus.replace("_", " ")} · {row.points} pts
                    </small>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="panel studio-panel" style={{ marginBottom: 20 }}>
        <p className="eyebrow">Personal studio</p>
        <p className="muted">Tap a card to coach in place.</p>
        <div className="pt-grid">
          {studio.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`pt-card ${selected?.id === row.id ? "is-on" : ""} ${row.todayStatus === "in_progress" ? "is-live" : ""}`}
              onClick={() => setSelected(row)}
            >
              <span className="eyebrow">{goalLabel(row.goal)}</span>
              <h3>{row.name}</h3>
              <p>
                {row.weightKg} kg · BMI {row.bmi} · {row.kcal} kcal
              </p>
              <p className="fine">{row.todayStatus.replace("_", " ")} · last {row.lastWorkout}</p>
            </button>
          ))}
        </div>
        {selected?.program === "PT" ? (
          <form onSubmit={send} className="coach-bar">
            <label className="form-field" style={{ flex: 1, margin: 0 }}>
              Note to {selected.name}
              <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Cue, load change, check-in…" />
            </label>
            <button className="primary" type="submit">
              Send
            </button>
          </form>
        ) : null}
      </div>

      <div className="panel floor-panel" style={{ marginBottom: 20 }}>
        <p className="eyebrow">Group floor · secondary</p>
        <table className="table quiet-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Goal</th>
              <th>Today</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            {floor.map((r) => (
              <tr key={r.id} className={selected?.id === r.id ? "is-on" : undefined} onClick={() => setSelected(r)}>
                <td>{r.name}</td>
                <td>{goalLabel(r.goal)}</td>
                <td>{r.todayStatus.replace("_", " ")}</td>
                <td>{r.weightKg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="panel" onSubmit={savePlan}>
        <p className="eyebrow">Floor plan · exactly 5 variations</p>
        <label className="form-field">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="form-field">
          Muscle
          <input value={muscle} onChange={(e) => setMuscle(e.target.value)} />
        </label>
        <label className="form-field">
          Exercise IDs (5, comma-separated)
          <input value={ids} onChange={(e) => setIds(e.target.value)} />
        </label>
        <button className="primary" type="submit">
          Publish
        </button>
      </form>
      <Toast message={toast} />
      <Confetti fire={burst} />
    </AppShell>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

export function Confetti({ fire }: { fire: number }) {
  const [pieces, setPieces] = useState<{ id: number; left: number; delay: number; duration: number; color: string; rot: number }[]>([]);

  useEffect(() => {
    if (!fire) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#c4a574", "#e8e2d6", "#8faf7a", "#f3e6c8", "#c45c4a"];
    setPieces(
      Array.from({ length: 90 }, (_, i) => ({
        id: fire * 100 + i,
        left: Math.random() * 100,
        delay: Math.random() * 0.35,
        duration: 1.6 + Math.random() * 1.4,
        color: colors[i % colors.length],
        rot: Math.random() * 360,
      })),
    );
    const t = window.setTimeout(() => setPieces([]), 2800);
    return () => window.clearTimeout(t);
  }, [fire]);

  if (!pieces.length) return null;

  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p) => (
        <i
          key={p.id}
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            background: p.color,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function LeaderBoards({
  rows,
}: {
  rows: { name: string; kcal: number; points: number; gained: number }[];
}) {
  const burned = useMemo(() => [...rows].sort((a, b) => b.kcal - a.kcal).slice(0, 5), [rows]);
  const earned = useMemo(() => [...rows].sort((a, b) => b.points - a.points).slice(0, 5), [rows]);
  const gained = useMemo(() => [...rows].sort((a, b) => b.gained - a.gained).slice(0, 5), [rows]);

  return (
    <div className="grid-3" style={{ marginBottom: 20 }}>
      <Board title="Burned more" unit="kcal" rows={burned.map((r) => ({ name: r.name, value: Math.round(r.kcal) }))} />
      <Board title="Earned more" unit="pts" rows={earned.map((r) => ({ name: r.name, value: r.points }))} />
      <Board title="Gained more" unit="kg" rows={gained.map((r) => ({ name: r.name, value: r.gained }))} />
    </div>
  );
}

function Board({
  title,
  unit,
  rows,
}: {
  title: string;
  unit: string;
  rows: { name: string; value: number }[];
}) {
  return (
    <div className="panel">
      <p className="eyebrow">{title}</p>
      <ol className="board-list">
        {rows.map((row, i) => (
          <li key={row.name}>
            <span>
              <b>{i + 1}</b> {row.name}
            </span>
            <strong>
              {row.value}
              <small> {unit}</small>
            </strong>
          </li>
        ))}
      </ol>
    </div>
  );
}

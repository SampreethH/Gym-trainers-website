"use client";

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

export function FormDemo({
  exercise,
}: {
  exercise: NonNullable<SetRow["exercise"]>;
}) {
  return (
    <div className="demo">
      <div className="demo-stage" aria-hidden>
        <div className="figure">
          <i className="head" />
          <i className="torso" />
          <i className="arm l" />
          <i className="arm r" />
          <i className="leg l" />
          <i className="leg r" />
        </div>
      </div>
      <div>
        <p className="eyebrow">Form studio</p>
        <h3>{exercise.name}</h3>
        <p className="muted">{exercise.cues}</p>
        <div className="chips">
          <span>{exercise.primaryMuscle}</span>
          {exercise.secondary.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
        <p className="fine">{exercise.equipment}</p>
      </div>
    </div>
  );
}

export function WorkoutBoard({
  sets,
  onChange,
  onCompleteSet,
}: {
  sets: SetRow[];
  onChange: (setId: string, patch: Partial<SetRow>) => void;
  onCompleteSet: (set: SetRow) => void;
}) {
  const grouped = new Map<string, SetRow[]>();
  for (const set of sets) {
    const list = grouped.get(set.exerciseId) ?? [];
    list.push(set);
    grouped.set(set.exerciseId, list);
  }

  return (
    <div className="workout-stack">
      {[...grouped.entries()].map(([exerciseId, rows]) => {
        const meta = rows[0]?.exercise;
        const done = rows.filter((r) => r.completedAt).length;
        return (
          <article key={exerciseId} className="panel exercise-card">
            {meta ? <FormDemo exercise={meta} /> : null}
            <p className="fine">
              {done}/{rows.length} sets counted · incomplete rows are excluded from totals
            </p>
            <div className="set-table">
              <div className="set-head">
                <span>Set</span>
                <span>Reps</span>
                <span>Weight</span>
                <span>Rest (sec)</span>
                <span>Notes</span>
                <span />
              </div>
              {rows.map((row) => (
                <div key={row.id} className={`set-row ${row.completedAt ? "is-done" : ""}`}>
                  <strong>{row.setNumber}</strong>
                  <input
                    value={row.reps}
                    disabled={Boolean(row.completedAt)}
                    onChange={(e) => onChange(row.id, { reps: e.target.value })}
                    inputMode="numeric"
                  />
                  <input
                    value={row.weightKg}
                    disabled={Boolean(row.completedAt)}
                    onChange={(e) => onChange(row.id, { weightKg: e.target.value })}
                    inputMode="decimal"
                  />
                  <input
                    value={row.restSeconds}
                    disabled={Boolean(row.completedAt)}
                    onChange={(e) => onChange(row.id, { restSeconds: e.target.value })}
                    inputMode="numeric"
                  />
                  <input
                    value={row.notes}
                    disabled={Boolean(row.completedAt)}
                    onChange={(e) => onChange(row.id, { notes: e.target.value })}
                  />
                  <button
                    type="button"
                    className="complete"
                    disabled={Boolean(row.completedAt)}
                    onClick={(event) => {
                      const wrap = event.currentTarget.closest(".set-row");
                      const inputs = wrap?.querySelectorAll("input");
                      const next = {
                        ...row,
                        reps: inputs?.[0]?.value ?? row.reps,
                        weightKg: inputs?.[1]?.value ?? row.weightKg,
                        restSeconds: inputs?.[2]?.value ?? row.restSeconds,
                        notes: inputs?.[3]?.value ?? row.notes,
                      };
                      onCompleteSet(next);
                    }}
                  >
                    {row.completedAt ? "Counted" : "Complete Set"}
                  </button>
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function CertificateCard({
  certificate,
}: {
  certificate: {
    token: string;
    clientName: string;
    date: string;
    programLabel: string;
    validSets: number;
    totalKg: number;
    durationMin: number;
    muscles: string[];
  };
}) {
  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}/share/${certificate.token}`;
  const text = `${certificate.clientName} completed ${certificate.programLabel} — ${certificate.validSets} counted sets.`;

  return (
    <div className="certificate">
      <p className="eyebrow">Session certificate</p>
      <h2>{certificate.clientName}</h2>
      <p className="muted">
        {certificate.programLabel} · {certificate.date}
      </p>
      <div className="cert-metrics">
        <div>
          <strong>{certificate.validSets}</strong>
          <span>counted sets</span>
        </div>
        <div>
          <strong>{Math.round(certificate.totalKg)}</strong>
          <span>kg volume</span>
        </div>
        <div>
          <strong>{certificate.durationMin}m</strong>
          <span>session</span>
        </div>
      </div>
      <p className="fine">{certificate.muscles.join(" · ")}</p>
      <div className="share-row">
        <a className="ghost" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer">
          Share on X
        </a>
        <a className="ghost" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer">
          Facebook
        </a>
        <button
          type="button"
          className="primary"
          onClick={async () => {
            if (navigator.share) {
              await navigator.share({ title: "Elevate OS", text, url: shareUrl });
            } else {
              await navigator.clipboard.writeText(shareUrl);
              alert("Share link copied — save the certificate image for Instagram.");
            }
          }}
        >
          Instagram / copy
        </button>
      </div>
    </div>
  );
}

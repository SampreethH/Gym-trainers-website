import { getStore } from "@/lib/store";
import { notFound } from "next/navigation";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const store = await getStore();
  const cert = store.certificates.find((c) => c.token === token);
  if (!cert) notFound();
  return (
    <div className="paywall">
      <div className="certificate" style={{ textAlign: "left", maxWidth: 420 }}>
        <p className="eyebrow">Elevate OS</p>
        <h1>{cert.clientName}</h1>
        <p className="muted">
          {cert.programLabel} · {cert.date}
        </p>
        <div className="cert-metrics">
          <div>
            <strong>{cert.validSets}</strong>
            <span>counted sets</span>
          </div>
          <div>
            <strong>{Math.round(cert.totalKg)}</strong>
            <span>kg volume</span>
          </div>
          <div>
            <strong>{cert.durationMin}m</strong>
            <span>session</span>
          </div>
        </div>
        <p className="fine">{cert.muscles.join(" · ")}</p>
      </div>
    </div>
  );
}

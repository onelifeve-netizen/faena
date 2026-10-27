"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Job, JobStatus, JobWip } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import FormError from "@/components/FormError";
import { useMyRole, canWrite } from "@/lib/roles";
import { toReference, formatMoney } from "@/lib/currency";

const TABS: { key: JobStatus; label: string }[] = [
  { key: "planificada", label: "Futuras" },
  { key: "en_curso", label: "En curso" },
  { key: "terminada", label: "Terminadas" },
];

export default function Obras() {
  const { role } = useMyRole();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [wips, setWips] = useState<JobWip[]>([]);
  const [refCurrency, setRefCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<JobStatus>("en_curso");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const [jobsRes, wipRes, settingsRes] = await Promise.all([
        supabase.from("jobs").select("*").order("created_at", { ascending: false }),
        supabase.from("job_wip").select("*"),
        supabase.from("settings").select("*").eq("key", "reference_currency").single(),
      ]);
      if (jobsRes.error) setError("No se pudieron cargar las obras. Revisá tu conexión y recargá la página.");
      setJobs(jobsRes.data ?? []);
      setWips((wipRes.data as JobWip[]) ?? []);
      if (settingsRes.data) setRefCurrency(settingsRes.data.value);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = jobs.filter((j) => j.status === tab);

  const pending = jobs
    .map((j) => {
      const wip = wips.find((w) => w.job_id === j.id);
      if (!wip) return null;
      const pendingRef = toReference(Number(j.budget), Number(j.budget_fx_rate)) - Number(wip.collected_amount);
      return { job: j, pendingRef };
    })
    .filter((x): x is { job: Job; pendingRef: number } => x !== null && x.pendingRef > 0)
    .sort((a, b) => b.pendingRef - a.pendingRef);

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-steel uppercase tracking-wide">Trabajos y proyectos</p>
          <h1 className="font-display font-bold text-3xl text-ink">Obras</h1>
        </div>
        {canWrite(role) && (
          <Link
            href="/obras/nueva"
            className="focus-ring bg-ink text-white text-sm px-4 py-2 rounded-tag hover:bg-ink/90 transition-colors"
          >
            + Nueva obra
          </Link>
        )}
      </header>

      <FormError message={error} />

      {!loading && pending.length > 0 && (
        <section className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6">
          <h2 className="font-display font-bold text-sm mb-1">Cobros pendientes</h2>
          <p className="text-[11px] text-steel font-mono mb-3">Presupuesto convertido a {refCurrency} menos lo cobrado hasta ahora, en todas las obras.</p>
          <div className="space-y-1.5">
            {pending.map(({ job, pendingRef }) => (
              <Link key={job.id} href={`/obras/detalle?id=${job.id}`} className="focus-ring flex items-center justify-between text-sm hover:underline">
                <span className="text-ink">{job.name}</span>
                <span className="serial text-warn">{formatMoney(pendingRef, refCurrency)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-1 mb-6 border border-line rounded-tag p-1 w-fit bg-panel">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`focus-ring text-sm px-4 py-1.5 rounded-tag transition-colors ${
              tab === t.key ? "bg-ink text-white" : "text-steel hover:bg-base"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs opacity-70">
              {jobs.filter((j) => j.status === t.key).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-steel text-sm">Cargando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-steel border border-dashed border-line rounded-tag px-4 py-6 text-center">
          No hay obras en "{TABS.find((t) => t.key === tab)?.label}" por ahora.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((j) => (
            <Link key={j.id} href={`/obras/detalle?id=${j.id}`} className="asset-tag block px-5 py-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-ink">{j.name}</p>
                  <p className="text-xs text-steel mt-0.5">
                    {j.client && <span>{j.client} · </span>}
                    {j.location && <span>{j.location} · </span>}
                    {j.start_date && <span>desde {j.start_date}</span>}
                    {j.end_date && <span> hasta {j.end_date}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="serial">{Number(j.budget).toLocaleString("es-AR")} {j.budget_currency}</span>
                  <StatusBadge status={j.status} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

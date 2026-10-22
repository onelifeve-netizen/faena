"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Job, JobStatus } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import FormError from "@/components/FormError";
import { useMyRole, canWrite } from "@/lib/roles";

const TABS: { key: JobStatus; label: string }[] = [
  { key: "planificada", label: "Futuras" },
  { key: "en_curso", label: "En curso" },
  { key: "terminada", label: "Terminadas" },
];

export default function Obras() {
  const { role } = useMyRole();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<JobStatus>("en_curso");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
      if (error) setError("No se pudieron cargar las obras. Revisá tu conexión y recargá la página.");
      setJobs(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = jobs.filter((j) => j.status === tab);

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

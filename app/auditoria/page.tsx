"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import FormError from "@/components/FormError";

interface AuditEntry {
  id: string;
  entity_type: string;
  action: string;
  detail: string | null;
  user_email: string | null;
  created_at: string;
}

const ENTITY_LABELS: Record<string, string> = {
  machine: "Inventario",
  job: "Obra",
  job_expense: "Gasto",
  job_payment: "Pago",
  job_invoice: "Factura",
  job_worker: "Colaborador",
  work_order: "Orden de trabajo",
  maintenance_schedule: "Mantenimiento",
  user_role: "Usuario",
};

function toCsvValue(value: string | null) {
  const v = (value ?? "").replace(/"/g, '""');
  return `"${v}"`;
}

export default function Auditoria() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) setError("No se pudo cargar la auditoría. Revisá tu conexión y recargá la página.");
      setEntries(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const entityTypes = useMemo(() => Array.from(new Set(entries.map((e) => e.entity_type))), [entries]);
  const users = useMemo(() => Array.from(new Set(entries.map((e) => e.user_email).filter(Boolean))) as string[], [entries]);

  const filtered = entries.filter((e) => {
    const day = e.created_at.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (entityFilter && e.entity_type !== entityFilter) return false;
    if (userFilter && e.user_email !== userFilter) return false;
    return true;
  });

  function exportCsv() {
    const header = "fecha,tipo,accion,detalle,usuario";
    const rows = filtered.map((e) =>
      [
        toCsvValue(new Date(e.created_at).toLocaleString("es-AR")),
        toCsvValue(ENTITY_LABELS[e.entity_type] ?? e.entity_type),
        toCsvValue(e.action),
        toCsvValue(e.detail),
        toCsvValue(e.user_email),
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `faena-auditoria-${from || "inicio"}-a-${to || "hoy"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <header className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-mono text-xs text-steel uppercase tracking-wide">Trazabilidad de cambios</p>
          <h1 className="font-display font-bold text-3xl text-ink">Auditoría</h1>
        </div>
        <button onClick={exportCsv} className="focus-ring bg-ink text-white text-xs px-3 py-1.5 rounded-tag hover:bg-ink/90">
          Exportar CSV
        </button>
      </header>

      <div className="flex items-center gap-2 flex-wrap mb-6">
        <input type="date" className="focus-ring border border-line rounded-tag px-2 py-1.5 text-xs bg-white" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-xs text-steel">a</span>
        <input type="date" className="focus-ring border border-line rounded-tag px-2 py-1.5 text-xs bg-white" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="focus-ring border border-line rounded-tag px-2 py-1.5 text-xs bg-white" value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
          <option value="">Todas las secciones</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>{ENTITY_LABELS[t] ?? t}</option>
          ))}
        </select>
        <select className="focus-ring border border-line rounded-tag px-2 py-1.5 text-xs bg-white" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
          <option value="">Todo el equipo</option>
          {users.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        {(from || to || entityFilter || userFilter) && (
          <button
            onClick={() => { setFrom(""); setTo(""); setEntityFilter(""); setUserFilter(""); }}
            className="focus-ring text-xs text-accent font-mono hover:underline"
          >
            limpiar filtros
          </button>
        )}
      </div>

      <FormError message={error} />

      {loading ? (
        <p className="text-steel text-sm">Cargando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-steel border border-dashed border-line rounded-tag px-4 py-6 text-center">
          {entries.length === 0 ? "Todavía no hay cambios registrados." : "Nada coincide con estos filtros."}
        </p>
      ) : (
        <div className="space-y-1">
          {filtered.map((e) => (
            <div key={e.id} className="flex items-start gap-3 text-sm border-b border-line py-2">
              <span className="badge bg-info/10 text-info shrink-0">{ENTITY_LABELS[e.entity_type] ?? e.entity_type}</span>
              <div className="flex-1">
                <p className="text-ink">{e.detail ?? e.action}</p>
                <p className="text-[11px] text-steel font-mono mt-0.5">
                  {e.user_email} · {new Date(e.created_at).toLocaleString("es-AR")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

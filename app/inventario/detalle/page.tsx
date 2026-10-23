"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Machine, WorkOrder, MaintenanceSchedule, MachineDepreciation, MachineSpec } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import DepreciationChart from "@/components/DepreciationChart";
import FormError from "@/components/FormError";
import { runMutation } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { useMyRole, canWrite } from "@/lib/roles";

export default function InventarioDetalle() {
  return (
    <Suspense fallback={<p className="text-steel text-sm">Cargando...</p>}>
      <InventarioDetalleInner />
    </Suspense>
  );
}

function InventarioDetalleInner() {
  const { role } = useMyRole();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const [machine, setMachine] = useState<Machine | null>(null);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [depreciation, setDepreciation] = useState<MachineDepreciation | null>(null);
  const [specs, setSpecs] = useState<MachineSpec[]>([]);
  const [specLabel, setSpecLabel] = useState("");
  const [specValue, setSpecValue] = useState("");
  const [specError, setSpecError] = useState("");
  const [loading, setLoading] = useState(true);
  const [failureDesc, setFailureDesc] = useState("");
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [diagnosisError, setDiagnosisError] = useState("");

  async function load() {
    const [machRes, ordersRes, schedRes, depRes, specsRes] = await Promise.all([
      supabase.from("machines").select("*").eq("id", id).single(),
      supabase.from("work_orders").select("*").eq("machine_id", id).order("created_at", { ascending: false }),
      supabase.from("maintenance_schedules").select("*").eq("machine_id", id).order("next_due_at", { ascending: true }),
      supabase.from("machine_depreciation").select("*").eq("machine_id", id).maybeSingle(),
      supabase.from("machine_specs").select("*").eq("machine_id", id).order("created_at", { ascending: true }),
    ]);
    setMachine(machRes.data);
    setOrders(ordersRes.data ?? []);
    setSchedules(schedRes.data ?? []);
    setDepreciation((depRes.data as MachineDepreciation) ?? null);
    setSpecs((specsRes.data as MachineSpec[]) ?? []);
    setLoading(false);
  }

  async function addSpec(e: React.FormEvent) {
    e.preventDefault();
    if (!specLabel.trim() || !specValue.trim()) return;
    const ok = await runMutation(
      () => supabase.from("machine_specs").insert({ machine_id: id, label: specLabel.trim(), value: specValue.trim() }),
      setSpecError
    );
    if (!ok) return;
    await logAudit("machine_spec", id, "especificación agregada", `${specLabel.trim()}: ${specValue.trim()}`);
    setSpecLabel("");
    setSpecValue("");
    load();
  }

  async function removeSpec(spec: MachineSpec) {
    setSpecError("");
    const ok = await runMutation(() => supabase.from("machine_specs").delete().eq("id", spec.id), setSpecError);
    if (!ok) return;
    await logAudit("machine_spec", id, "especificación quitada", `${spec.label}: ${spec.value}`);
    load();
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function pedirDiagnostico(e: React.FormEvent) {
    e.preventDefault();
    if (!failureDesc.trim()) return;
    setDiagnosing(true);
    setDiagnosis(null);
    setDiagnosisError("");
    const { data, error } = await supabase.functions.invoke("ai-diagnostico", {
      body: { machine_id: id, failure_description: failureDesc },
    });
    setDiagnosing(false);
    if (error) {
      setDiagnosisError("No se pudo obtener el diagnóstico. ¿Está desplegada la función ai-diagnostico en Supabase?");
      return;
    }
    setDiagnosis(data?.suggestion ?? "Sin respuesta.");
  }

  if (loading) return <p className="text-steel text-sm">Cargando...</p>;
  if (!machine) return <p className="text-steel text-sm">No se encontró el equipo.</p>;

  return (
    <div className="max-w-3xl">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-steel uppercase tracking-wide">
            {machine.category || "Equipo"}{machine.location && ` · ${machine.location}`}
          </p>
          <h1 className="font-display font-bold text-3xl text-ink">{machine.name}</h1>
          <p className="serial mt-1">{machine.serial || "sin N.° de serie"}</p>
        </div>
        <StatusBadge status={machine.status} />
      </header>

      {/* Asistente de mantenimiento con IA */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6">
        <h2 className="font-display font-bold text-sm mb-1">Asistente de mantenimiento (IA)</h2>
        <p className="text-xs text-steel mb-3">
          Describí la falla y el asistente la compara contra el historial de este equipo para
          sugerir una causa probable y si conviene adelantar el próximo preventivo.
        </p>
        <form onSubmit={pedirDiagnostico} className="flex gap-2">
          <input
            className="focus-ring flex-1 border border-line rounded-tag px-3 py-1.5 text-sm"
            placeholder="Ej: pierde presión al arrancar en frío"
            value={failureDesc}
            onChange={(e) => setFailureDesc(e.target.value)}
          />
          <button disabled={diagnosing} className="focus-ring bg-accent text-white text-sm px-4 py-1.5 rounded-tag hover:opacity-90 disabled:opacity-50">
            {diagnosing ? "Pensando..." : "Diagnosticar"}
          </button>
        </form>
        {diagnosisError && <p className="text-xs text-warn mt-3">{diagnosisError}</p>}
        {diagnosis && (
          <div className="mt-3 bg-base rounded-tag p-3 text-sm text-ink whitespace-pre-wrap">{diagnosis}</div>
        )}
      </section>

      {/* Ficha técnica / especificaciones */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6">
        <h2 className="font-display font-bold text-sm mb-1">Especificaciones técnicas</h2>
        <p className="text-xs text-steel mb-3">
          Datos que querés tener siempre a mano sin buscarlos en un manual: tipo de aceite, modelo
          de filtro, n.° de serie de una pieza, lo que necesites para este equipo.
        </p>
        {specs.length === 0 ? (
          <p className="text-sm text-steel mb-3">Todavía no cargaste especificaciones.</p>
        ) : (
          <div className="space-y-1.5 mb-3">
            {specs.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm border-b border-line pb-1.5">
                <span><span className="text-steel">{s.label}:</span> <span className="text-ink">{s.value}</span></span>
                {canWrite(role) && (
                  <button onClick={() => removeSpec(s)} className="focus-ring text-xs text-warn font-mono hover:underline">
                    quitar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {canWrite(role) && (
          <form onSubmit={addSpec} className="flex gap-2">
            <input
              className="focus-ring flex-1 border border-line rounded-tag px-3 py-1.5 text-sm"
              placeholder="Etiqueta (ej: Filtro de aceite)"
              value={specLabel}
              onChange={(e) => setSpecLabel(e.target.value)}
            />
            <input
              className="focus-ring flex-1 border border-line rounded-tag px-3 py-1.5 text-sm"
              placeholder="Valor (ej: Mann W940)"
              value={specValue}
              onChange={(e) => setSpecValue(e.target.value)}
            />
            <button className="focus-ring bg-accent text-white text-sm px-4 py-1.5 rounded-tag hover:opacity-90 shrink-0">
              Agregar
            </button>
          </form>
        )}
        <FormError message={specError} />
      </section>

      {/* Depreciación e inversión */}
      {depreciation?.purchase_price != null && depreciation.purchase_price_ref != null ? (
        <section className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6">
          <h2 className="font-display font-bold text-sm mb-1">Depreciación e inversión</h2>
          <p className="text-[11px] text-steel font-mono mb-4">
            Método lineal: valor de compra ÷ vida útil en años. Comprado en {formatNumber(depreciation.purchase_price)} {depreciation.purchase_price_currency}, convertido acá a tu moneda de referencia.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <DepStat label="Valor de compra" value={formatNumber(depreciation.purchase_price_ref)} />
            <DepStat label="Depreciación anual" value={depreciation.annual_depreciation != null ? formatNumber(depreciation.annual_depreciation) : "—"} />
            <DepStat label="Valor en libros hoy" value={depreciation.book_value != null ? formatNumber(depreciation.book_value) : "—"} />
            <DepStat label="Gasto de mantenimiento acumulado" value={formatNumber(depreciation.maintenance_cost_total)} tone={depreciation.maintenance_cost_total > depreciation.purchase_price_ref * 0.3 ? "warn" : undefined} />
          </div>
          {depreciation.useful_life_years && depreciation.years_elapsed != null && (
            <DepreciationChart
              purchasePrice={depreciation.purchase_price_ref}
              usefulLifeYears={depreciation.useful_life_years}
              yearsElapsed={depreciation.years_elapsed}
            />
          )}
          {depreciation.book_value != null && depreciation.maintenance_cost_total > depreciation.book_value && (
            <p className="text-xs text-warn mt-3">
              El mantenimiento acumulado ya superó el valor en libros del equipo — evaluar si conviene seguir reparando o reemplazarlo.
            </p>
          )}
        </section>
      ) : (
        <section className="bg-panel border border-dashed border-line rounded-tag shadow-card p-5 mb-6">
          <p className="text-xs text-steel">
            Sin datos de compra cargados — no se puede calcular depreciación ni comparar contra el gasto de mantenimiento.
            Editalo desde Inventario para agregar precio, fecha de compra y vida útil.
          </p>
        </section>
      )}

      {/* Mantenimiento preventivo programado */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6">
        <h2 className="font-display font-bold text-sm mb-3">Mantenimiento preventivo</h2>
        {schedules.length === 0 ? (
          <p className="text-sm text-steel">Sin reglas programadas para este equipo.</p>
        ) : (
          <div className="space-y-2">
            {schedules.map((s) => (
              <div key={s.id} className="flex justify-between text-sm border-b border-line pb-1">
                <span>{s.name} · cada {s.frequency_days} días</span>
                <span className="serial">próximo: {s.next_due_at}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Historial de órdenes de trabajo */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5">
        <h2 className="font-display font-bold text-sm mb-3">Historial de órdenes de trabajo</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-steel">Sin órdenes de trabajo registradas todavía.</p>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="border-b border-line pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{o.title}</span>
                  <StatusBadge status={o.status} />
                </div>
                <p className="text-xs text-steel mt-0.5">
                  {o.type} · {new Date(o.created_at).toLocaleDateString("es-AR")}
                  {o.cost ? ` · costo ${o.cost}` : ""}
                </p>
                {o.closed_note && <p className="text-xs text-steel mt-0.5">{o.closed_note}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatNumber(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function DepStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-base rounded-tag px-3 py-2">
      <p className={`font-display font-bold text-sm ${tone ? `text-${tone}` : "text-ink"}`}>{value}</p>
      <p className="text-[11px] text-steel mt-0.5">{label}</p>
    </div>
  );
}

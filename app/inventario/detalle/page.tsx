"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Machine, WorkOrder, WorkOrderType, WorkOrderPriority, WorkOrderStatus, MaintenanceSchedule, MachineDepreciation, MachineSpec } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import DepreciationChart from "@/components/DepreciationChart";
import MachineTimeline from "@/components/MachineTimeline";
import FormError from "@/components/FormError";
import { runMutation, functionErrorMessage } from "@/lib/errors";
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
  const [summarizing, setSummarizing] = useState(false);
  const [healthSummary, setHealthSummary] = useState<string | null>(null);
  const [healthError, setHealthError] = useState("");
  const [readingTag, setReadingTag] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<{ label: string; value: string }[]>([]);
  const [tagError, setTagError] = useState("");
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderTitle, setOrderTitle] = useState("");
  const [orderType, setOrderType] = useState<WorkOrderType>("correctivo");
  const [orderPriority, setOrderPriority] = useState<WorkOrderPriority>("media");
  const [orderDesc, setOrderDesc] = useState("");
  const [orderError, setOrderError] = useState("");
  const [closingOrderId, setClosingOrderId] = useState<string | null>(null);
  const [closeNote, setCloseNote] = useState("");
  const [closeCost, setCloseCost] = useState("");

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

  async function addOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!orderTitle.trim()) return;
    const ok = await runMutation(
      () =>
        supabase.from("work_orders").insert({
          machine_id: id,
          type: orderType,
          title: orderTitle,
          description: orderDesc || null,
          priority: orderPriority,
        }),
      setOrderError
    );
    if (!ok) return;
    await logAudit("work_order", id, "orden creada", `"${orderTitle}" (${orderType}) para ${machine?.name}`);
    setOrderTitle("");
    setOrderDesc("");
    setOrderType("correctivo");
    setOrderPriority("media");
    setShowOrderForm(false);
    load();
  }

  async function setOrderStatus(order: WorkOrder, status: WorkOrderStatus) {
    if (status === "cerrada") {
      setClosingOrderId(order.id);
      return;
    }
    setOrderError("");
    const ok = await runMutation(() => supabase.from("work_orders").update({ status }).eq("id", order.id), setOrderError);
    if (!ok) return;
    await logAudit("work_order", order.id, "cambio de estado", `"${order.title}" pasó a "${status}"`);
    load();
  }

  async function closeOrder(order: WorkOrder) {
    setOrderError("");
    const ok = await runMutation(
      () =>
        supabase
          .from("work_orders")
          .update({
            status: "cerrada",
            closed_at: new Date().toISOString(),
            closed_note: closeNote || null,
            cost: closeCost ? Number(closeCost) : null,
          })
          .eq("id", order.id),
      setOrderError
    );
    if (!ok) return;
    await logAudit("work_order", order.id, "orden cerrada", `"${order.title}" cerrada${closeCost ? ` — costo ${closeCost}` : ""}`);
    setClosingOrderId(null);
    setCloseNote("");
    setCloseCost("");
    load();
  }

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
      setDiagnosisError(await functionErrorMessage(error, "No se pudo obtener el diagnóstico. ¿Está desplegada la función ai-diagnostico en Supabase?"));
      return;
    }
    setDiagnosis(data?.suggestion ?? "Sin respuesta.");
  }

  async function pedirResumenSalud() {
    setSummarizing(true);
    setHealthSummary(null);
    setHealthError("");
    const { data, error } = await supabase.functions.invoke("resumen-salud", {
      body: { machine_id: id },
    });
    setSummarizing(false);
    if (error) {
      setHealthError(await functionErrorMessage(error, "No se pudo obtener el resumen. ¿Está desplegada la función resumen-salud en Supabase?"));
      return;
    }
    setHealthSummary(data?.summary ?? "Sin respuesta.");
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleTagPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setTagError("");
    setTagSuggestions([]);
    setReadingTag(true);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("leer-chapa", {
        body: { image_base64: base64, media_type: file.type || "image/jpeg" },
      });
      if (error) {
        setTagError(await functionErrorMessage(error, "No se pudo leer la chapa automáticamente. Cargá las especificaciones a mano."));
      } else if (!data || data.error || !Array.isArray(data.specs)) {
        setTagError(data?.error ?? "No se pudo leer la chapa automáticamente. Cargá las especificaciones a mano.");
      } else if (data.specs.length === 0) {
        setTagError("No se detectó texto legible en la foto.");
      } else {
        setTagSuggestions(data.specs);
      }
    } catch {
      setTagError("No se pudo leer la chapa automáticamente. Cargá las especificaciones a mano.");
    } finally {
      setReadingTag(false);
    }
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

        <div className="mt-4 pt-4 border-t border-line">
          <p className="text-xs text-steel mb-2">
            ¿No hay una falla puntual? Pedí un resumen general de salud del equipo (vida útil restante,
            mantenimiento hecho, qué falta, y si conviene seguir invirtiendo o evaluar un reemplazo).
          </p>
          <button
            onClick={pedirResumenSalud}
            disabled={summarizing}
            className="focus-ring bg-ink text-white text-sm px-4 py-1.5 rounded-tag hover:bg-ink/90 disabled:opacity-50"
          >
            {summarizing ? "Analizando..." : "Resumen de salud del equipo"}
          </button>
          {healthError && <p className="text-xs text-warn mt-3">{healthError}</p>}
          {healthSummary && (
            <div className="mt-3 bg-base rounded-tag p-3 text-sm text-ink whitespace-pre-wrap">{healthSummary}</div>
          )}
        </div>
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
          <>
            <label className="focus-ring inline-flex items-center gap-1.5 text-xs text-accent font-mono hover:underline mb-2 cursor-pointer">
              📷 {readingTag ? "Leyendo chapa..." : "Leer chapa/matrícula con IA"}
              <input type="file" accept="image/*" className="hidden" onChange={handleTagPhoto} disabled={readingTag} />
            </label>
            {tagError && <p className="text-[11px] text-warn mb-2">{tagError}</p>}
            {tagSuggestions.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {tagSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setSpecLabel(s.label); setSpecValue(s.value); }}
                    className="focus-ring text-[11px] bg-info/10 text-info px-2 py-1 rounded-tag hover:opacity-80"
                  >
                    {s.label}: {s.value}
                  </button>
                ))}
              </div>
            )}
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
          </>
        )}
        <FormError message={specError} />
      </section>

      {/* Línea de tiempo del equipo */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6">
        <h2 className="font-display font-bold text-sm mb-1">Línea de tiempo del equipo</h2>
        {machine.purchase_date ? (
          <>
            <p className="text-[11px] text-steel font-mono mb-3">
              Compra → mantenimientos realizados → hoy → próximo preventivo → fin de vida útil estimado.
            </p>
            <MachineTimeline
              purchaseDate={machine.purchase_date}
              usefulLifeYears={machine.useful_life_years}
              orders={orders}
              schedules={schedules}
            />
          </>
        ) : (
          <p className="text-xs text-steel">
            Sin fecha de compra cargada — no se puede armar la línea de tiempo. Editalo desde Inventario.
          </p>
        )}
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

      {/* Órdenes de trabajo del equipo */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-bold text-sm">Órdenes de trabajo</h2>
          {canWrite(role) && (
            <button onClick={() => setShowOrderForm((s) => !s)} className="focus-ring text-xs text-accent font-mono hover:underline">
              {showOrderForm ? "cancelar" : "+ nueva orden"}
            </button>
          )}
        </div>
        <p className="text-xs text-steel mb-3">Correctivos, inspecciones y emergencias de este equipo — lo preventivo se programa desde Mantenimiento.</p>

        {showOrderForm && canWrite(role) && (
          <form onSubmit={addOrder} className="mb-4 bg-base rounded-tag p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              className="focus-ring sm:col-span-2 border border-line rounded-tag px-3 py-1.5 text-sm"
              placeholder="Título (ej: pierde presión al arrancar)"
              value={orderTitle}
              onChange={(e) => setOrderTitle(e.target.value)}
              required
            />
            <select className="focus-ring border border-line rounded-tag px-3 py-1.5 text-sm bg-white" value={orderType} onChange={(e) => setOrderType(e.target.value as WorkOrderType)}>
              <option value="correctivo">Correctivo</option>
              <option value="inspeccion">Inspección</option>
              <option value="emergencia">Emergencia</option>
            </select>
            <select className="focus-ring border border-line rounded-tag px-3 py-1.5 text-sm bg-white" value={orderPriority} onChange={(e) => setOrderPriority(e.target.value as WorkOrderPriority)}>
              <option value="baja">Prioridad baja</option>
              <option value="media">Prioridad media</option>
              <option value="alta">Prioridad alta</option>
            </select>
            <textarea
              className="focus-ring sm:col-span-2 border border-line rounded-tag px-3 py-1.5 text-sm"
              placeholder="Descripción (opcional)"
              value={orderDesc}
              onChange={(e) => setOrderDesc(e.target.value)}
              rows={2}
            />
            <button className="focus-ring sm:col-span-2 bg-ink text-white text-sm py-1.5 rounded-tag">Crear orden</button>
          </form>
        )}
        <FormError message={orderError} />

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

                {canWrite(role) && o.status !== "cerrada" && closingOrderId !== o.id && (
                  <div className="flex gap-2 mt-1.5">
                    {o.status === "pendiente" && (
                      <button onClick={() => setOrderStatus(o, "en_curso")} className="focus-ring text-xs text-accent font-mono hover:underline">
                        iniciar
                      </button>
                    )}
                    <button onClick={() => setOrderStatus(o, "cerrada")} className="focus-ring text-xs text-ok font-mono hover:underline">
                      cerrar
                    </button>
                  </div>
                )}

                {closingOrderId === o.id && (
                  <div className="mt-1.5 space-y-2 bg-base rounded-tag p-2">
                    <input
                      className="focus-ring w-full border border-line rounded-tag px-2 py-1 text-xs"
                      placeholder="Nota de cierre (qué se hizo)"
                      value={closeNote}
                      onChange={(e) => setCloseNote(e.target.value)}
                    />
                    <input
                      className="focus-ring w-full border border-line rounded-tag px-2 py-1 text-xs"
                      placeholder="Costo (opcional)"
                      type="number"
                      value={closeCost}
                      onChange={(e) => setCloseCost(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => closeOrder(o)} className="focus-ring bg-ink text-white text-xs px-3 py-1 rounded-tag">
                        Confirmar cierre
                      </button>
                      <button onClick={() => setClosingOrderId(null)} className="focus-ring text-xs text-steel font-mono">
                        cancelar
                      </button>
                    </div>
                  </div>
                )}
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

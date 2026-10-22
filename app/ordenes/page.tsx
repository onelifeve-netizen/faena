"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { WorkOrder, WorkOrderStatus } from "@/lib/types";
import { logAudit } from "@/lib/audit";
import { useMyRole, canWrite } from "@/lib/roles";
import { runMutation } from "@/lib/errors";
import FormError from "@/components/FormError";

const STATUS_COLUMNS: { status: WorkOrderStatus; label: string }[] = [
  { status: "pendiente", label: "Pendientes" },
  { status: "en_curso", label: "En curso" },
  { status: "cerrada", label: "Cerradas" },
];

const PRIORITY_STYLES: Record<string, string> = {
  baja: "bg-steel/10 text-steel",
  media: "bg-info/10 text-info",
  alta: "bg-warn/10 text-warn",
};

const TYPE_LABELS: Record<string, string> = {
  correctivo: "Correctivo",
  preventivo: "Preventivo",
  inspeccion: "Inspección",
  emergencia: "Emergencia",
};

export default function Ordenes() {
  const { role } = useMyRole();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeNote, setCloseNote] = useState("");
  const [closeCost, setCloseCost] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [ordersRes, profilesRes] = await Promise.all([
      supabase.from("work_orders").select("*, machine:machines(*), job:jobs(name)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, email"),
    ]);
    if (ordersRes.error) setError("No se pudieron cargar las órdenes. Revisá tu conexión y recargá la página.");
    setOrders((ordersRes.data as WorkOrder[]) ?? []);
    const map: Record<string, string> = {};
    (profilesRes.data ?? []).forEach((p: any) => (map[p.id] = p.email));
    setEmails(map);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(order: WorkOrder, status: WorkOrderStatus) {
    if (status === "cerrada") {
      setClosingId(order.id);
      return;
    }
    setError("");
    const ok = await runMutation(() => supabase.from("work_orders").update({ status }).eq("id", order.id), setError);
    if (!ok) return;
    await logAudit("work_order", order.id, "cambio de estado", `"${order.title}" pasó a "${status}"`);
    load();
  }

  async function closeOrder(order: WorkOrder) {
    setError("");
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
      setError
    );
    if (!ok) return;
    await logAudit("work_order", order.id, "orden cerrada", `"${order.title}" cerrada${closeCost ? ` — costo ${closeCost}` : ""}`);
    setClosingId(null);
    setCloseNote("");
    setCloseCost("");
    load();
  }

  return (
    <div>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-steel uppercase tracking-wide">Correctivo, preventivo e inspecciones</p>
          <h1 className="font-display font-bold text-3xl text-ink">Órdenes de trabajo</h1>
        </div>
        {canWrite(role) && (
          <Link href="/ordenes/nueva" className="focus-ring bg-ink text-white text-sm px-4 py-2 rounded-tag hover:bg-ink/90 transition-colors">
            + Nueva orden
          </Link>
        )}
      </header>

      <FormError message={error} />

      {loading ? (
        <p className="text-steel text-sm">Cargando...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {STATUS_COLUMNS.map((col) => (
            <section key={col.status}>
              <h2 className="font-display font-bold text-sm mb-3 text-steel uppercase tracking-wide">
                {col.label} <span className="font-mono">({orders.filter((o) => o.status === col.status).length})</span>
              </h2>
              <div className="space-y-2">
                {orders.filter((o) => o.status === col.status).map((o) => (
                  <div key={o.id} className="asset-tag px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{o.title}</span>
                      <span className={`badge ${PRIORITY_STYLES[o.priority]}`}>{o.priority}</span>
                    </div>
                    <p className="text-xs text-steel mt-1">{o.machine?.name} · {TYPE_LABELS[o.type]}</p>
                    {o.job?.name && <p className="text-[11px] text-accent font-mono mt-0.5">obra: {o.job.name}</p>}
                    {o.assigned_to && <p className="text-[11px] text-steel font-mono mt-0.5">{emails[o.assigned_to] ?? "—"}</p>}
                    {o.description && <p className="text-xs text-steel mt-1">{o.description}</p>}

                    {canWrite(role) && o.status !== "cerrada" && closingId !== o.id && (
                      <div className="flex gap-2 mt-2">
                        {o.status === "pendiente" && (
                          <button onClick={() => setStatus(o, "en_curso")} className="focus-ring text-xs text-accent font-mono hover:underline">
                            iniciar
                          </button>
                        )}
                        <button onClick={() => setStatus(o, "cerrada")} className="focus-ring text-xs text-ok font-mono hover:underline">
                          cerrar
                        </button>
                      </div>
                    )}

                    {closingId === o.id && (
                      <div className="mt-2 space-y-2 bg-base rounded-tag p-2">
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
                          <button onClick={() => setClosingId(null)} className="focus-ring text-xs text-steel font-mono">
                            cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {o.status === "cerrada" && o.closed_note && (
                      <p className="text-[11px] text-steel mt-1 border-t border-line pt-1">{o.closed_note}</p>
                    )}
                  </div>
                ))}
                {orders.filter((o) => o.status === col.status).length === 0 && (
                  <p className="text-xs text-steel border border-dashed border-line rounded-tag px-3 py-4 text-center">
                    Nada acá.
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Machine, MaintenanceSchedule } from "@/lib/types";
import { logAudit } from "@/lib/audit";
import { useMyRole, canWrite } from "@/lib/roles";
import { runMutation } from "@/lib/errors";
import FormError from "@/components/FormError";

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function Mantenimiento() {
  const { role } = useMyRole();
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [machineId, setMachineId] = useState("");
  const [name, setName] = useState("");
  const [reminderDays, setReminderDays] = useState("7");
  const [frequency, setFrequency] = useState("90");
  const [formError, setFormError] = useState("");
  const [listError, setListError] = useState("");
  const [orderCreatedFor, setOrderCreatedFor] = useState<string | null>(null);

  async function load() {
    const [schedRes, machRes] = await Promise.all([
      supabase.from("maintenance_schedules").select("*, machine:machines(*)").order("next_due_at", { ascending: true }),
      supabase.from("machines").select("*").order("name"),
    ]);
    if (schedRes.error || machRes.error) setListError("No se pudo cargar el mantenimiento. Revisá tu conexión y recargá la página.");
    setSchedules((schedRes.data as MaintenanceSchedule[]) ?? []);
    setMachines(machRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!machineId || !name.trim()) return;
    const freq = Number(frequency);
    const today = new Date().toISOString().slice(0, 10);
    let newId: string | null = null;
    const ok = await runMutation(async () => {
      const { data, error } = await supabase
        .from("maintenance_schedules")
        .insert({
          machine_id: machineId,
          name,
          frequency_days: freq,
          reminder_days_before: reminderDays ? Number(reminderDays) : 7,
          next_due_at: addDays(today, freq),
        })
        .select()
        .single();
      newId = data?.id ?? null;
      return { error };
    }, setFormError);
    if (!ok) return;
    if (newId) await logAudit("maintenance_schedule", newId, "regla creada", `"${name}" cada ${freq} días para ${machines.find((m) => m.id === machineId)?.name}`);
    setMachineId("");
    setName("");
    setReminderDays("7");
    setFrequency("90");
    setShowForm(false);
    load();
  }

  async function markDone(s: MaintenanceSchedule) {
    setListError("");
    const today = new Date().toISOString().slice(0, 10);
    const ok = await runMutation(
      () =>
        supabase
          .from("maintenance_schedules")
          .update({ last_done_at: today, next_due_at: addDays(today, s.frequency_days) })
          .eq("id", s.id),
      setListError
    );
    if (!ok) return;
    await logAudit("maintenance_schedule", s.id, "mantenimiento realizado", `"${s.name}" (${s.machine?.name}) — próximo: ${addDays(today, s.frequency_days)}`);
    load();
  }

  async function toggleActive(s: MaintenanceSchedule) {
    setListError("");
    const ok = await runMutation(() => supabase.from("maintenance_schedules").update({ active: !s.active }).eq("id", s.id), setListError);
    if (!ok) return;
    load();
  }

  async function crearOrden(s: MaintenanceSchedule, overdue: boolean) {
    setListError("");
    let newId: string | null = null;
    const ok = await runMutation(async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .insert({
          machine_id: s.machine_id,
          type: "preventivo",
          title: s.name,
          description: `Generada desde la regla de mantenimiento "${s.name}" (cada ${s.frequency_days} días).`,
          priority: overdue ? "alta" : "media",
        })
        .select()
        .single();
      newId = data?.id ?? null;
      return { error };
    }, setListError);
    if (!ok) return;
    if (newId) {
      await logAudit("work_order", newId, "orden creada", `"${s.name}" (preventivo) para ${s.machine?.name} — desde Mantenimiento`);
      setOrderCreatedFor(s.id);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-steel uppercase tracking-wide">Reglas recurrentes por equipo</p>
          <h1 className="font-display font-bold text-3xl text-ink">Mantenimiento preventivo</h1>
          <p className="text-xs text-steel mt-1 max-w-md">
            Acá definís la regla ("cada X días hacer tal cosa"). Cuando llegue el momento, usá
            "crear orden de trabajo" para generar el ticket real, gestionable desde el detalle del equipo en Inventario.
          </p>
        </div>
        {canWrite(role) && (
          <button onClick={() => setShowForm((s) => !s)} className="focus-ring bg-ink text-white text-sm px-4 py-2 rounded-tag hover:bg-ink/90 transition-colors">
            {showForm ? "Cancelar" : "+ Nueva regla"}
          </button>
        )}
      </header>

      {showForm && (
        <form onSubmit={addSchedule} className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select className="focus-ring sm:col-span-2 border border-line rounded-tag px-3 py-2 text-sm bg-white" value={machineId} onChange={(e) => setMachineId(e.target.value)} required>
            <option value="">Elegir equipo...</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input className="focus-ring sm:col-span-2 border border-line rounded-tag px-3 py-2 text-sm" placeholder="Ej: cambio de aceite" value={name} onChange={(e) => setName(e.target.value)} required />

          <label className="block text-xs text-steel">
            Avisar con cuántos días de anticipación
            <input
              className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm"
              placeholder="Ej: 7"
              type="number"
              value={reminderDays}
              onChange={(e) => setReminderDays(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs text-steel">
            Cada cuántos días se repite
            <input
              className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm"
              placeholder="Ej: 90"
              type="number"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              required
            />
          </label>

          <div className="sm:col-span-2">
            <button type="submit" className="focus-ring bg-accent text-white text-sm px-4 py-2 rounded-tag hover:opacity-90">Guardar regla</button>
            <FormError message={formError} />
          </div>
        </form>
      )}

      <FormError message={listError} />

      {loading ? (
        <p className="text-steel text-sm">Cargando...</p>
      ) : schedules.length === 0 ? (
        <p className="text-sm text-steel border border-dashed border-line rounded-tag px-4 py-6 text-center">
          Todavía no hay reglas de mantenimiento programadas.
        </p>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => {
            const overdue = s.next_due_at < today;
            const soon = !overdue && s.next_due_at <= addDays(today, s.reminder_days_before);
            return (
              <div key={s.id} className={`asset-tag px-5 py-4 flex items-center justify-between ${!s.active ? "opacity-50" : ""}`}>
                <div>
                  <p className="font-medium text-sm text-ink">{s.name} · {s.machine?.name}</p>
                  <p className="text-xs text-steel mt-0.5">
                    cada {s.frequency_days} días · aviso {s.reminder_days_before} días antes · último: {s.last_done_at ?? "nunca"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge ${overdue ? "bg-warn/10 text-warn" : soon ? "bg-info/10 text-info" : "bg-ok/10 text-ok"}`}>
                    {overdue ? "vencido" : soon ? "próximo" : "al día"} · {s.next_due_at}
                  </span>
                  {canWrite(role) && (
                    <>
                      {orderCreatedFor === s.id ? (
                        <Link href={`/inventario/detalle?id=${s.machine_id}`} className="focus-ring text-xs text-ok font-mono hover:underline">
                          ✓ orden creada — ver →
                        </Link>
                      ) : (
                        <button onClick={() => crearOrden(s, overdue)} className="focus-ring text-xs text-accent font-mono hover:underline">
                          crear orden de trabajo
                        </button>
                      )}
                      <button onClick={() => markDone(s)} className="focus-ring text-xs text-accent font-mono hover:underline">
                        hecho hoy
                      </button>
                      <button onClick={() => toggleActive(s)} className="focus-ring text-xs text-steel font-mono hover:underline">
                        {s.active ? "pausar" : "reactivar"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

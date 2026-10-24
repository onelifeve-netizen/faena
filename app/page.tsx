"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Machine, Job, WorkOrder, MaintenanceSchedule, JobWip } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { IconBox, IconBuilding, IconClipboard, IconWrench } from "@/components/Icons";
import DonutChart from "@/components/DonutChart";
import MaintenanceCalendar from "@/components/MaintenanceCalendar";
import { formatMoney } from "@/lib/currency";

export default function Dashboard() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [openOrders, setOpenOrders] = useState<WorkOrder[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [wip, setWip] = useState<JobWip[]>([]);
  const [refCurrency, setRefCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [m, j, wo, ms, wipRes, settingsRes] = await Promise.all([
        supabase.from("machines").select("*"),
        supabase.from("jobs").select("*").order("created_at", { ascending: false }),
        supabase.from("work_orders").select("*, machine:machines(*)").neq("status", "cerrada"),
        supabase.from("maintenance_schedules").select("*, machine:machines(*)").eq("active", true),
        supabase.from("job_wip").select("*"),
        supabase.from("settings").select("*").eq("key", "reference_currency").single(),
      ]);
      setMachines(m.data ?? []);
      setJobs(j.data ?? []);
      setOpenOrders((wo.data as WorkOrder[]) ?? []);
      setSchedules((ms.data as MaintenanceSchedule[]) ?? []);
      setWip((wipRes.data as JobWip[]) ?? []);
      if (settingsRes.data) setRefCurrency(settingsRes.data.value);
      setLoading(false);
    }
    load();
  }, []);

  const disponibles = machines.filter((m) => m.status === "disponible").length;
  const enMantenimiento = machines.filter((m) => m.status === "mantenimiento").length;
  const activas = jobs.filter((j) => j.status === "en_curso").length;

  const today = new Date().toISOString().slice(0, 10);

  function addDays(dateStr: string, days: number) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  const vencidas = schedules.filter((s) => s.next_due_at < today);
  const proximas = schedules.filter((s) => s.next_due_at >= today && s.next_due_at <= addDays(today, s.reminder_days_before));

  const activeJobIds = new Set(jobs.filter((j) => j.status !== "terminada").map((j) => j.id));
  const activeWip = wip.filter((w) => activeJobIds.has(w.job_id));
  const resultadoTotal = activeWip.reduce((sum, w) => sum + Number(w.estimated_result), 0);
  const netoCaja = activeWip.reduce((sum, w) => sum + (Number(w.collected_amount) - Number(w.cost_incurred)), 0);

  const enObra = machines.filter((m) => m.status === "en_obra").length;

  return (
    <div>
      <header className="mb-8">
        <p className="font-mono text-xs text-steel uppercase tracking-wide">Panel general</p>
        <h1 className="font-display font-bold text-3xl text-ink">Resumen</h1>
      </header>

      {loading ? (
        <p className="text-steel text-sm">Cargando...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Equipos disponibles" value={disponibles} accent="ok" icon={IconBox} href="/inventario" emptyCta="+ agregar el primer equipo" />
            <StatCard label="Obras en curso" value={activas} accent="accent" icon={IconBuilding} href="/obras" emptyCta="+ crear la primera obra" />
            <StatCard label="Órdenes de trabajo abiertas" value={openOrders.length} accent="info" icon={IconClipboard} href="/ordenes" emptyCta="+ crear una orden" />
            <StatCard label="Preventivos vencidos" value={vencidas.length} accent={vencidas.length > 0 ? "warn" : "ok"} icon={IconWrench} href="/mantenimiento" emptyCta="programar un mantenimiento" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Link
              href="/obras"
              className="focus-ring col-span-2 relative overflow-hidden rounded-tag p-5 text-white block hover:opacity-95 transition-opacity"
              style={{ background: "linear-gradient(135deg, #12172B 0%, #3B2170 100%)" }}
            >
              <div className="absolute -right-6 -top-10 w-40 h-40 rounded-full bg-gold/10" />
              <div className="absolute -right-2 bottom-0 w-24 h-24 rounded-full bg-white/5" />
              <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs uppercase tracking-wide font-mono mb-1 text-white/60">WIP (devengado) de obras activas</p>
                  <p className={`font-display font-bold text-xl ${resultadoTotal >= 0 ? "text-gold" : "text-warn"}`}>
                    {resultadoTotal >= 0 ? "Ganancia" : "Pérdida"}: {formatMoney(Math.abs(resultadoTotal), refCurrency)}
                  </p>
                  <p className="text-[11px] text-white/50 mt-1">Costo-a-costo: devengado menos costo incurrido.</p>
                </div>
                <div className="border-l border-white/10 pl-6">
                  <p className="text-xs uppercase tracking-wide font-mono mb-1 text-white/60">Neto de caja de obras activas</p>
                  <p className={`font-display font-bold text-xl ${netoCaja >= 0 ? "text-ok" : "text-warn"}`}>
                    {formatMoney(Math.abs(netoCaja), refCurrency)} {netoCaja >= 0 ? "a favor" : "en contra"}
                  </p>
                  <p className="text-[11px] text-white/50 mt-1">Lo cobrado menos lo gastado, sin estimar avance.</p>
                </div>
              </div>
              <p className="relative text-[11px] text-white/50 mt-4 pt-3 border-t border-white/10">
                Se arma con los gastos, facturas y cobros de todas las obras en curso — ver el detalle de cada una en Obras →
              </p>
            </Link>

            <div className="bg-panel border border-line rounded-tag shadow-card p-5 flex flex-col">
              <p className="text-xs uppercase tracking-wide font-mono text-steel mb-3">Estados de equipos</p>
              <DonutChart
                size={96}
                segments={[
                  { label: "Disponibles", value: disponibles, color: "#0E9F6E" },
                  { label: "En obra", value: enObra, color: "#2563EB" },
                  { label: "Mantenimiento", value: enMantenimiento, color: "#D97706" },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-lg">Obras recientes</h2>
                <Link href="/obras" className="text-xs text-accent font-mono hover:underline">ver todas →</Link>
              </div>
              <div className="space-y-2">
                {jobs.slice(0, 5).map((j) => (
                  <Link key={j.id} href={`/obras/detalle?id=${j.id}`} className="asset-tag block px-4 py-3 hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{j.name}</span>
                      <StatusBadge status={j.status} />
                    </div>
                  </Link>
                ))}
                {jobs.length === 0 && <EmptyHint text="Todavía no cargaste ninguna obra." href="/obras/nueva" cta="+ crear la primera obra" />}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-lg">Preventivos próximos</h2>
                <Link href="/mantenimiento" className="text-xs text-accent font-mono hover:underline">ver todo →</Link>
              </div>
              <div className="space-y-2">
                {[...vencidas, ...proximas].slice(0, 5).map((s) => (
                  <div key={s.id} className="asset-tag px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{s.machine?.name}</span>
                      <span className={`badge ${s.next_due_at < today ? "bg-warn/10 text-warn" : "bg-info/10 text-info"}`}>{s.next_due_at}</span>
                    </div>
                    <p className="text-xs text-steel mt-0.5">{s.name}</p>
                  </div>
                ))}
                {vencidas.length === 0 && proximas.length === 0 && <EmptyHint text="Nada vencido ni próximo." href="/mantenimiento" cta="programar un mantenimiento" />}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-lg">Equipos en mantenimiento</h2>
                <Link href="/inventario" className="text-xs text-accent font-mono hover:underline">ver todo →</Link>
              </div>
              <div className="space-y-2">
                {machines.filter((m) => m.status === "mantenimiento").slice(0, 5).map((m) => (
                  <div key={m.id} className={`asset-tag status-${m.status} px-4 py-3`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{m.name}</span>
                      <span className="serial">{m.serial}</span>
                    </div>
                  </div>
                ))}
                {enMantenimiento === 0 && <EmptyHint text="Nada en mantenimiento por ahora." href="/inventario" cta="ver inventario" />}
              </div>
            </section>
          </div>

          <section className="mt-8 bg-panel border border-line rounded-tag shadow-card p-5 max-w-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-lg">Calendario de mantenimiento</h2>
              <Link href="/mantenimiento" className="text-xs text-accent font-mono hover:underline">ver todo →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <MaintenanceCalendar schedules={schedules} />
                <div className="flex items-center gap-4 mt-3 text-[11px] text-steel">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-warn" />vencido</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-info" />programado</span>
                </div>
              </div>
              <div className="sm:border-l sm:border-line sm:pl-5">
                <p className="text-[11px] text-steel uppercase tracking-wide font-mono mb-2">A tener en cuenta</p>
                {[...vencidas, ...proximas].length === 0 ? (
                  <p className="text-xs text-steel">Nada vencido ni próximo.</p>
                ) : (
                  <div className="space-y-1.5">
                    {[...vencidas, ...proximas].slice(0, 5).map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-xs">
                        <span className="text-steel truncate">{s.machine?.name} — {s.name}</span>
                        <span className={s.next_due_at < today ? "text-warn" : "text-info"}>{s.next_due_at}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  icon: Icon,
  href,
  emptyCta,
}: {
  label: string;
  value: number;
  accent: string;
  icon: (props: { className?: string }) => React.ReactElement;
  href: string;
  emptyCta: string;
}) {
  return (
    <Link href={href} className="focus-ring block bg-panel border border-line rounded-tag shadow-card px-4 py-4 hover:shadow-sm transition-shadow">
      <div className={`w-8 h-8 rounded-tag flex items-center justify-center mb-3 bg-${accent}/10`}>
        <Icon className={`text-${accent}`} />
      </div>
      <p className={`font-display font-bold text-3xl text-${accent}`}>{value}</p>
      <p className="text-xs text-steel mt-1">{value === 0 ? emptyCta : label}</p>
    </Link>
  );
}

function EmptyHint({ text, href, cta }: { text: string; href?: string; cta?: string }) {
  return (
    <div className="text-sm text-steel border border-dashed border-line rounded-tag px-4 py-3">
      <p>{text}</p>
      {href && cta && (
        <Link href={href} className="focus-ring text-xs text-accent font-mono hover:underline mt-1 inline-block">
          {cta} →
        </Link>
      )}
    </div>
  );
}

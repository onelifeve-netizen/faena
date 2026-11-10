"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, Variants } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Machine, Job, MaintenanceSchedule, JobWip, JobRequirement, ToolConditionLog } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { IconBox, IconBuilding, IconClipboard, IconWrench } from "@/components/Icons";
import DonutChart from "@/components/DonutChart";
import MaintenanceCalendar from "@/components/MaintenanceCalendar";
import AnimatedNumber from "@/components/AnimatedNumber";
import { formatMoney } from "@/lib/currency";
import { jobMissingCount } from "@/lib/jobRequirements";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

export default function Dashboard() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [wip, setWip] = useState<JobWip[]>([]);
  const [requirements, setRequirements] = useState<JobRequirement[]>([]);
  const [conditionLogs, setConditionLogs] = useState<ToolConditionLog[]>([]);
  const [refCurrency, setRefCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [showWipBreakdown, setShowWipBreakdown] = useState(false);

  useEffect(() => {
    async function load() {
      const [m, j, ms, wipRes, settingsRes, reqRes, condRes] = await Promise.all([
        supabase.from("machines").select("*"),
        supabase.from("jobs").select("*").order("created_at", { ascending: false }),
        supabase.from("maintenance_schedules").select("*, machine:machines(*)").eq("active", true),
        supabase.from("job_wip").select("*"),
        supabase.from("settings").select("*").eq("key", "reference_currency").single(),
        supabase.from("job_requirements").select("*"),
        supabase.from("tool_condition_logs").select("*").order("created_at", { ascending: false }),
      ]);
      setMachines(m.data ?? []);
      setJobs(j.data ?? []);
      setRequirements((reqRes.data as JobRequirement[]) ?? []);
      setSchedules((ms.data as MaintenanceSchedule[]) ?? []);
      setWip((wipRes.data as JobWip[]) ?? []);
      setConditionLogs((condRes.data as ToolConditionLog[]) ?? []);
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

  const activeJobsList = jobs.filter((j) => j.status !== "terminada");
  const activeJobIds = new Set(activeJobsList.map((j) => j.id));
  const activeWip = wip.filter((w) => activeJobIds.has(w.job_id));
  const resultadoTotal = activeWip.reduce((sum, w) => sum + Number(w.estimated_result), 0);
  const netoCaja = activeWip.reduce((sum, w) => sum + (Number(w.collected_amount) - Number(w.cost_incurred)), 0);
  const wipByJob = new Map(wip.map((w) => [w.job_id, w]));

  const enObra = machines.filter((m) => m.status === "en_obra").length;

  const latestConditionByMachine = new Map<string, ToolConditionLog>();
  for (const log of conditionLogs) {
    if (!latestConditionByMachine.has(log.machine_id)) latestConditionByMachine.set(log.machine_id, log);
  }
  const aReponer = Array.from(latestConditionByMachine.values()).filter((l) => l.condition === "reponer").length;

  const jobsWithMissing = jobs
    .filter((j) => j.status !== "terminada")
    .map((j) => ({ job: j, missing: jobMissingCount(requirements.filter((r) => r.job_id === j.id), machines) }))
    .filter((x) => x.missing > 0);

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
          <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Equipos disponibles" value={disponibles} accent="ok" icon={IconBox} href="/inventario" emptyCta="+ agregar el primer equipo" />
            <StatCard label="Obras en curso" value={activas} accent="accent" icon={IconBuilding} href="/obras" emptyCta="+ crear la primera obra" />
            <StatCard label="Herramientas a reponer" value={aReponer} accent={aReponer > 0 ? "warn" : "ok"} icon={IconClipboard} href="/inventario" emptyCta="todo en buen estado" />
            <StatCard label="Preventivos vencidos" value={vencidas.length} accent={vencidas.length > 0 ? "warn" : "ok"} icon={IconWrench} href="/mantenimiento" emptyCta="programar un mantenimiento" />
          </motion.div>

          {jobsWithMissing.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" as const }}
              className="bg-warn/10 border border-warn/20 rounded-tag p-4 mb-6"
            >
              <p className="text-sm font-medium text-warn mb-2">
                ⚠ {jobsWithMissing.length} obra(s) con equipo/herramientas faltantes para lo que necesitan
              </p>
              <div className="space-y-1">
                {jobsWithMissing.map(({ job, missing }) => (
                  <Link key={job.id} href={`/obras/detalle?id=${job.id}`} className="focus-ring flex items-center justify-between text-xs hover:underline">
                    <span className="text-ink">{job.name}</span>
                    <span className="text-warn font-mono">{missing} ítem(s) sin cubrir →</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <motion.div variants={fadeUp} className="col-span-2">
            <div
              className="focus-ring relative overflow-hidden rounded-tag p-5 text-white"
              style={{ background: "linear-gradient(135deg, #12172B 0%, #3B2170 100%)" }}
            >
              <div className="absolute -right-6 -top-10 w-40 h-40 rounded-full bg-gold/10 pointer-events-none" />
              <div className="absolute -right-2 bottom-0 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
              <div className="relative flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-wide font-mono text-white/60">Resultado financiero</p>
                  <p className="text-[11px] text-white/40 mt-0.5">Acumulado a hoy en {activeJobsList.length} obra{activeJobsList.length === 1 ? "" : "s"} en curso</p>
                </div>
                <Link href="/obras" className="focus-ring text-[11px] text-white/60 font-mono hover:text-white hover:underline">
                  ver obras →
                </Link>
              </div>

              {activeJobsList.length === 0 ? (
                <p className="relative text-sm text-white/60">No hay obras en curso todavía.</p>
              ) : (
                <>
                  <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs uppercase tracking-wide font-mono mb-1 text-white/60">Ganancia estimada (devengado)</p>
                      <p className={`font-display font-bold text-xl ${resultadoTotal >= 0 ? "text-gold" : "text-warn"}`}>
                        {resultadoTotal >= 0 ? "+" : "−"}{formatMoney(Math.abs(resultadoTotal), refCurrency)}
                      </p>
                      <p className="text-[11px] text-white/50 mt-1">Lo devengado según avance, menos el costo incurrido — no es caja real.</p>
                    </div>
                    <div className="border-l border-white/10 pl-6">
                      <p className="text-xs uppercase tracking-wide font-mono mb-1 text-white/60">Caja neta (cobrado − gastado)</p>
                      <p className={`font-display font-bold text-xl ${netoCaja >= 0 ? "text-ok" : "text-warn"}`}>
                        {netoCaja >= 0 ? "+" : "−"}{formatMoney(Math.abs(netoCaja), refCurrency)}
                      </p>
                      <p className="text-[11px] text-white/50 mt-1">Plata que realmente entró menos la que realmente salió, sin estimar avance.</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowWipBreakdown((s) => !s)}
                    className="focus-ring relative mt-4 pt-3 border-t border-white/10 w-full flex items-center justify-between text-[11px] text-white/60 hover:text-white"
                  >
                    <span>{showWipBreakdown ? "ocultar" : "ver"} desglose por obra ({activeJobsList.length})</span>
                    <span>{showWipBreakdown ? "▴" : "▾"}</span>
                  </button>

                  {showWipBreakdown && (
                    <div className="relative mt-2 space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {activeJobsList.map((j) => {
                        const w = wipByJob.get(j.id);
                        const result = w ? Number(w.estimated_result) : 0;
                        const net = w ? Number(w.collected_amount) - Number(w.cost_incurred) : 0;
                        return (
                          <Link
                            key={j.id}
                            href={`/obras/detalle?id=${j.id}`}
                            className="focus-ring flex items-center justify-between text-xs bg-white/5 hover:bg-white/10 rounded-tag px-3 py-1.5 transition-colors"
                          >
                            <span className="text-white/90 truncate pr-2">{j.name}</span>
                            <span className="flex items-center gap-3 shrink-0 font-mono">
                              <span className={result >= 0 ? "text-gold" : "text-warn"}>{result >= 0 ? "+" : "−"}{formatMoney(Math.abs(result), refCurrency)}</span>
                              <span className={net >= 0 ? "text-ok" : "text-warn"}>{net >= 0 ? "+" : "−"}{formatMoney(Math.abs(net), refCurrency)}</span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
            </motion.div>

            <motion.div variants={fadeUp}>
              <Link
                href="/inventario"
                className="focus-ring bg-panel border border-line rounded-tag shadow-card p-5 flex flex-col hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
              >
                <p className="text-xs uppercase tracking-wide font-mono text-steel mb-3">Estados de equipos</p>
                <DonutChart
                  size={96}
                  segments={[
                    { label: "Disponibles", value: disponibles, color: "#0E9F6E" },
                    { label: "En obra", value: enObra, color: "#2563EB" },
                    { label: "Mantenimiento", value: enMantenimiento, color: "#D97706" },
                  ]}
                />
                <p className="text-[11px] text-accent font-mono mt-2">ver inventario →</p>
              </Link>
            </motion.div>
          </motion.div>

          <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.section variants={fadeUp}>
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
            </motion.section>

            <motion.section variants={fadeUp}>
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
            </motion.section>

            <motion.section variants={fadeUp}>
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
            </motion.section>
          </motion.div>

          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" as const, delay: 0.2 }}
            className="mt-8 bg-panel border border-line rounded-tag shadow-card p-5 max-w-2xl"
          >
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
          </motion.section>
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
    <motion.div variants={fadeUp} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
      <Link href={href} className="focus-ring block bg-panel border border-line rounded-tag shadow-card px-4 py-4 hover:shadow-md transition-shadow">
        <div className={`w-8 h-8 rounded-tag flex items-center justify-center mb-3 bg-${accent}/10`}>
          <Icon className={`text-${accent}`} />
        </div>
        <p className={`font-display font-bold text-3xl text-${accent}`}><AnimatedNumber value={value} /></p>
        <p className="text-xs text-steel mt-1">{value === 0 ? emptyCta : label}</p>
      </Link>
    </motion.div>
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

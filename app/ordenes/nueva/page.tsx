"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Machine, Job, WorkOrderPriority, WorkOrderType } from "@/lib/types";
import { logAudit } from "@/lib/audit";
import { runMutation } from "@/lib/errors";
import FormError from "@/components/FormError";
import { useMyRole, canWrite } from "@/lib/roles";

interface TeamMember {
  user_id: string;
  label: string;
}

export default function NuevaOrden() {
  const router = useRouter();
  const { role, loading: roleLoading } = useMyRole();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [machineId, setMachineId] = useState("");
  const [jobId, setJobId] = useState("");
  const [type, setType] = useState<WorkOrderType>("correctivo");
  const [priority, setPriority] = useState<WorkOrderPriority>("media");
  const [assignedTo, setAssignedTo] = useState("");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("machines").select("*").order("name").then(({ data }) => setMachines(data ?? []));
    supabase.from("jobs").select("*").neq("status", "terminada").order("name").then(({ data }) => setJobs(data ?? []));
    supabase
      .from("user_roles")
      .select("user_id, approved, profile:profiles(email, first_name, last_name)")
      .eq("approved", true)
      .then(({ data }) => {
        const members = (data ?? []).map((r: any) => {
          const name = `${r.profile?.first_name ?? ""} ${r.profile?.last_name ?? ""}`.trim();
          return { user_id: r.user_id, label: name || r.profile?.email || "—" };
        });
        setTeam(members);
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!machineId || !title.trim()) return;
    let newId: string | null = null;
    const ok = await runMutation(async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .insert({ machine_id: machineId, job_id: jobId || null, type, priority, assigned_to: assignedTo || null, title, description })
        .select()
        .single();
      newId = data?.id ?? null;
      return { error };
    }, setError);
    if (!ok) return;
    if (newId) {
      const machineName = machines.find((m) => m.id === machineId)?.name;
      const jobName = jobs.find((j) => j.id === jobId)?.name;
      await logAudit("work_order", newId, "orden creada", `"${title}" (${type}) para ${machineName}${jobName ? ` — obra: ${jobName}` : ""}`);
    }
    router.push("/ordenes");
  }

  if (!roleLoading && !canWrite(role)) {
    return (
      <p className="text-sm text-steel border border-dashed border-line rounded-tag px-4 py-6 text-center">
        Tu rol es de solo lectura — no podés crear órdenes de trabajo.
      </p>
    );
  }

  return (
    <div className="max-w-lg">
      <header className="mb-6">
        <p className="font-mono text-xs text-steel uppercase tracking-wide">Nueva orden de trabajo</p>
        <h1 className="font-display font-bold text-3xl text-ink">Crear orden</h1>
      </header>

      <form onSubmit={submit} className="bg-panel border border-line rounded-tag shadow-card divide-y divide-line">
        <fieldset className="p-5">
          <legend className="font-display font-bold text-xs uppercase tracking-wide text-accent mb-3">¿Dónde va este trabajo?</legend>
          <div className="space-y-3">
            <label className="block text-xs text-steel">
              Equipo afectado
              <select
                className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm bg-white"
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                required
              >
                <option value="">Elegir equipo...</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-steel">
              Obra relacionada (opcional)
              <select
                className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm bg-white"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
              >
                <option value="">Sin obra — mantenimiento general</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.name}</option>
                ))}
              </select>
              <span className="block mt-1 text-[11px] text-steel/80">
                Elegí una obra si este trabajo es por algo que pasó ahí; dejalo en blanco si es mantenimiento general del equipo.
              </span>
            </label>
          </div>
        </fieldset>

        <fieldset className="p-5">
          <legend className="font-display font-bold text-xs uppercase tracking-wide text-accent mb-3">¿Qué tipo de trabajo es?</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-steel">
              Tipo
              <select className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm bg-white" value={type} onChange={(e) => setType(e.target.value as WorkOrderType)}>
                <option value="correctivo">Correctivo — algo se rompió</option>
                <option value="preventivo">Preventivo — mantenimiento programado</option>
                <option value="inspeccion">Inspección</option>
                <option value="emergencia">Emergencia</option>
              </select>
            </label>
            <label className="block text-xs text-steel">
              Prioridad
              <select className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm bg-white" value={priority} onChange={(e) => setPriority(e.target.value as WorkOrderPriority)}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset className="p-5">
          <legend className="font-display font-bold text-xs uppercase tracking-wide text-accent mb-3">¿Quién se hace cargo?</legend>
          <label className="block text-xs text-steel">
            Asignado a (opcional)
            <select
              className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm bg-white"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {team.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.label}</option>
              ))}
            </select>
            <span className="block mt-1 text-[11px] text-steel/80">
              Va a aparecer en su nombre en el tablero de Órdenes. Todavía no manda notificación automática por mail.
            </span>
          </label>
        </fieldset>

        <fieldset className="p-5">
          <legend className="font-display font-bold text-xs uppercase tracking-wide text-accent mb-3">Detalle</legend>
          <div className="space-y-3">
            <label className="block text-xs text-steel">
              Título
              <input
                className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm"
                placeholder="Ej: ruido raro en motor"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <label className="block text-xs text-steel">
              Descripción
              <textarea
                className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <div className="p-5">
          <button type="submit" className="focus-ring bg-accent text-white text-sm px-4 py-2 rounded-tag hover:opacity-90">
            Crear orden
          </button>
          <FormError message={error} />
        </div>
      </form>
    </div>
  );
}

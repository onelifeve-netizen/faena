"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMyRole } from "@/lib/roles";
import { UserRole, UserRoleRow, Profile, Company } from "@/lib/types";
import { logAudit } from "@/lib/audit";
import Avatar from "@/components/Avatar";
import FormError from "@/components/FormError";
import { runMutation } from "@/lib/errors";

interface Row extends UserRoleRow {
  profile: Profile;
}

const ROLE_GROUPS: { role: UserRole; label: string; hint: string }[] = [
  { role: "admin", label: "Administradores", hint: "acceso total, incluida la gestión de usuarios" },
  { role: "tecnico", label: "Técnicos", hint: "pueden crear y editar inventario, obras, órdenes, gastos" },
  { role: "lectura", label: "Solo lectura", hint: "pueden ver todo, no pueden crear ni editar" },
];

function fullName(p: Profile) {
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
}

export default function Usuarios() {
  const { role, loading: roleLoading } = useMyRole();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [company, setCompany] = useState<Company | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("user_roles")
      .select("user_id, role, approved, created_at, profile:profiles(id, email, first_name, last_name, avatar_url, created_at)")
      .order("created_at", { ascending: true });
    if (error) setError("No se pudo cargar la lista de usuarios. Revisá tu conexión y recargá la página.");
    setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    supabase.from("companies").select("id, name, invite_code, industry, created_at").maybeSingle().then(({ data }) => {
      setCompany(data);
    });
  }, []);

  async function approve(userId: string, email: string) {
    setError("");
    const ok = await runMutation(() => supabase.from("user_roles").update({ approved: true }).eq("user_id", userId), setError);
    if (!ok) return;
    await logAudit("user_role", userId, "trabajador aprobado", `Se aprobó el acceso de ${email}`);
    load();
  }

  async function revoke(userId: string, email: string) {
    setError("");
    const ok = await runMutation(() => supabase.from("user_roles").update({ approved: false }).eq("user_id", userId), setError);
    if (!ok) return;
    await logAudit("user_role", userId, "acceso revocado", `Se revocó el acceso de ${email}`);
    load();
  }

  async function changeRole(userId: string, newRole: UserRole, email: string) {
    setError("");
    const ok = await runMutation(() => supabase.from("user_roles").update({ role: newRole }).eq("user_id", userId), setError);
    if (!ok) return;
    await logAudit("user_role", userId, "cambio de rol", `${email} pasó a rol "${newRole}"`);
    load();
  }

  if (!roleLoading && role !== "admin") {
    return (
      <p className="text-sm text-steel border border-dashed border-line rounded-tag px-4 py-6 text-center">
        Solo un administrador puede ver esta sección.
      </p>
    );
  }

  const pending = rows.filter((r) => !r.approved);

  return (
    <div className="max-w-2xl">
      <header className="mb-8">
        <p className="font-mono text-xs text-steel uppercase tracking-wide">Acceso al equipo, por responsabilidad</p>
        <h1 className="font-display font-bold text-3xl text-ink">Usuarios</h1>
        {company && (
          <p className="text-xs text-steel mt-2">
            Empresa: <span className="text-ink font-medium">{company.name}</span> · código de invitación:{" "}
            <span className="serial">{company.invite_code}</span>
          </p>
        )}
      </header>

      <FormError message={error} />

      {loading ? (
        <p className="text-steel text-sm">Cargando...</p>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="mb-8">
              <h2 className="font-display font-bold text-sm mb-3 text-warn">Pendientes de aprobación</h2>
              <div className="space-y-2">
                {pending.map((r) => (
                  <div key={r.user_id} className="asset-tag px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar avatarUrl={r.profile.avatar_url} name={fullName(r.profile)} email={r.profile.email} />
                      <div>
                        <p className="text-sm">{fullName(r.profile) || r.profile.email}</p>
                        <p className="text-xs text-steel">{r.profile.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => approve(r.user_id, r.profile.email)}
                      className="focus-ring bg-ok text-white text-xs px-3 py-1.5 rounded-tag hover:opacity-90"
                    >
                      Aprobar
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {ROLE_GROUPS.map((group) => {
            const members = rows.filter((r) => r.approved && r.role === group.role);
            return (
              <section key={group.role} className="mb-8">
                <div className="mb-3">
                  <h2 className="font-display font-bold text-sm">{group.label} <span className="font-mono text-xs text-steel">({members.length})</span></h2>
                  <p className="text-[11px] text-steel">{group.hint}</p>
                </div>
                {members.length === 0 ? (
                  <p className="text-sm text-steel">Nadie con este rol todavía.</p>
                ) : (
                  <div className="space-y-2">
                    {members.map((r) => (
                      <div key={r.user_id} className="asset-tag px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar avatarUrl={r.profile.avatar_url} name={fullName(r.profile)} email={r.profile.email} />
                          <div>
                            <p className="text-sm">{fullName(r.profile) || r.profile.email}</p>
                            <p className="text-xs text-steel">{r.profile.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            className="focus-ring text-xs border border-line rounded-tag px-2 py-1 bg-white"
                            value={r.role}
                            onChange={(e) => changeRole(r.user_id, e.target.value as UserRole, r.profile.email)}
                          >
                            <option value="admin">Admin</option>
                            <option value="tecnico">Técnico</option>
                            <option value="lectura">Solo lectura</option>
                          </select>
                          <button
                            onClick={() => revoke(r.user_id, r.profile.email)}
                            className="focus-ring text-xs text-warn font-mono hover:underline"
                          >
                            revocar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

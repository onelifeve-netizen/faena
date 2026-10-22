"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Contact, Job } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import FormError from "@/components/FormError";
import { runMutation } from "@/lib/errors";
import { useMyRole, canWrite } from "@/lib/roles";

export default function Contactos() {
  return (
    <Suspense fallback={<p className="text-steel text-sm">Cargando...</p>}>
      <ContactosInner />
    </Suspense>
  );
}

function ContactosInner() {
  const { role: myRole } = useMyRole();
  const searchParams = useSearchParams();
  const openParam = searchParams.get("open");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [relatedJobs, setRelatedJobs] = useState<Record<string, Job[]>>({});
  const [formError, setFormError] = useState("");
  const [listError, setListError] = useState("");

  async function load() {
    const { data, error } = await supabase.from("contacts").select("*").order("name", { ascending: true });
    if (error) setListError("No se pudo cargar la lista de contactos. Revisá tu conexión y recargá la página.");
    setContacts(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (openParam && openId !== openParam && contacts.some((c) => c.id === openParam)) {
      toggleOpen(openParam);
      document.getElementById(`contact-${openParam}`)?.scrollIntoView({ block: "center" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openParam, contacts.length]);

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const ok = await runMutation(
      () => supabase.from("contacts").insert({ name, role, phone, email, location }),
      setFormError
    );
    if (!ok) return;
    setName("");
    setRole("");
    setPhone("");
    setEmail("");
    setLocation("");
    setShowForm(false);
    load();
  }

  async function toggleOpen(contactId: string) {
    const next = openId === contactId ? null : contactId;
    setOpenId(next);
    if (next && !relatedJobs[next]) {
      const [asClient, asWorker] = await Promise.all([
        supabase.from("jobs").select("id, name, status").eq("contact_id", next),
        supabase.from("job_workers").select("job:jobs(id, name, status)").eq("contact_id", next),
      ]);
      const fromWorker = (asWorker.data ?? []).map((r: any) => r.job).filter(Boolean);
      const merged = [...(asClient.data ?? []), ...fromWorker];
      const unique = Array.from(new Map(merged.map((j: any) => [j.id, j])).values()) as Job[];
      setRelatedJobs((prev) => ({ ...prev, [next]: unique }));
    }
  }

  const filtered = contacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-steel uppercase tracking-wide">Clientes, encargados, colaboradores y proveedores</p>
          <h1 className="font-display font-bold text-3xl text-ink">Contactos</h1>
        </div>
        {canWrite(myRole) && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="focus-ring bg-ink text-white text-sm px-4 py-2 rounded-tag hover:bg-ink/90 transition-colors"
          >
            {showForm ? "Cancelar" : "+ Agregar contacto"}
          </button>
        )}
      </header>

      {showForm && canWrite(myRole) && (
        <form onSubmit={addContact} className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6 grid grid-cols-2 gap-3">
          <Field label="Nombre completo" value={name} onChange={setName} placeholder="Juan Pérez" required />
          <Field label="Rol" value={role} onChange={setRole} placeholder="Cliente, electricista, proveedor..." />
          <Field label="Celular" value={phone} onChange={setPhone} placeholder="+54 9 11 1234-5678" />
          <Field label="Email (opcional)" value={email} onChange={setEmail} type="email" placeholder="juan@empresa.com" />
          <div className="col-span-2">
            <Field label="Ubicación" value={location} onChange={setLocation} placeholder="Zárate, Buenos Aires" />
          </div>
          <div className="col-span-2">
            <button type="submit" className="focus-ring bg-accent text-white text-sm px-4 py-2 rounded-tag hover:opacity-90">
              Guardar contacto
            </button>
            <FormError message={formError} />
          </div>
        </form>
      )}

      <FormError message={listError} />

      <input
        className="focus-ring w-full max-w-sm border border-line rounded-tag px-3 py-2 text-sm mb-4 bg-white"
        placeholder="Buscar por nombre..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p className="text-steel text-sm">Cargando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-steel border border-dashed border-line rounded-tag px-4 py-6 text-center">
          No hay contactos que coincidan.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.id} id={`contact-${c.id}`} className="border border-line rounded-tag shadow-card overflow-hidden bg-panel">
              <button
                onClick={() => toggleOpen(c.id)}
                className="focus-ring w-full flex items-center justify-between px-4 py-3 text-left hover:bg-base transition-colors"
              >
                <span className="text-sm font-medium text-ink">{c.name}</span>
                <span className="text-xs text-steel">{c.role || "sin rol"}</span>
              </button>
              {openId === c.id && (
                <div className="px-4 py-3 border-t border-line bg-base text-xs text-steel space-y-2">
                  <p>Celular: <span className="serial">{c.phone || "—"}</span></p>
                  <p>Email: {c.email || "sin email (opcional)"}</p>
                  <p>Ubicación: {c.location || "—"}</p>
                  {c.notes && <p>Notas: {c.notes}</p>}
                  <div className="pt-2 border-t border-line">
                    <p className="text-steel uppercase tracking-wide font-mono text-[10px] mb-1">Obras relacionadas</p>
                    {relatedJobs[c.id] === undefined ? (
                      <p>Cargando...</p>
                    ) : relatedJobs[c.id].length === 0 ? (
                      <p>Sin obras relacionadas todavía.</p>
                    ) : (
                      <div className="space-y-1">
                        {relatedJobs[c.id].map((j) => (
                          <Link key={j.id} href={`/obras/detalle?id=${j.id}`} className="flex items-center justify-between hover:underline">
                            <span className="text-ink">{j.name}</span>
                            <StatusBadge status={j.status} />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="text-xs text-steel">
      {label}
      <input
        type={type}
        className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm text-ink"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

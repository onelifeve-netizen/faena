"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ContactPicker from "@/components/ContactPicker";
import { Contact } from "@/lib/types";
import { CURRENCIES, toReference, formatMoney } from "@/lib/currency";
import { friendlyError } from "@/lib/errors";
import FormError from "@/components/FormError";
import FxRateField from "@/components/FxRateField";
import { useMyRole, canWrite } from "@/lib/roles";

interface TeamMember {
  user_id: string;
  email: string;
  name: string;
}

export default function NuevaObra() {
  const router = useRouter();
  const { role, loading: roleLoading } = useMyRole();
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("ARS");
  const [budgetFxRate, setBudgetFxRate] = useState("1");
  const [category, setCategory] = useState("");
  const [refCurrency, setRefCurrency] = useState("USD");
  const [historicalAvg, setHistoricalAvg] = useState<number | null>(null);
  const [location, setLocation] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [responsibleName, setResponsibleName] = useState("");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("settings").select("*").eq("key", "reference_currency").single().then(({ data }) => {
      if (data) setRefCurrency(data.value);
    });
    supabase
      .from("user_roles")
      .select("user_id, approved, profile:profiles(email, first_name, last_name)")
      .eq("approved", true)
      .then(({ data }) => {
        const members = (data ?? []).map((r: any) => ({
          user_id: r.user_id,
          email: r.profile?.email ?? "",
          name: `${r.profile?.first_name ?? ""} ${r.profile?.last_name ?? ""}`.trim(),
        }));
        setTeam(members);
      });
  }, []);

  useEffect(() => {
    async function compare() {
      if (!category.trim()) {
        setHistoricalAvg(null);
        return;
      }
      const { data } = await supabase
        .from("jobs")
        .select("budget, budget_fx_rate")
        .eq("status", "terminada")
        .ilike("category", category);
      if (data && data.length > 0) {
        const avg = data.reduce((sum, j) => sum + toReference(Number(j.budget), Number(j.budget_fx_rate)), 0) / data.length;
        setHistoricalAvg(avg);
      } else {
        setHistoricalAvg(null);
      }
    }
    const t = setTimeout(compare, 400);
    return () => clearTimeout(t);
  }, [category]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const { data, error } = await supabase
      .from("jobs")
      .insert({
        name,
        client,
        start_date: startDate || null,
        end_date: endDate || null,
        budget: budget ? Number(budget) : 0,
        budget_currency: budgetCurrency,
        budget_fx_rate: budgetFxRate ? Number(budgetFxRate) : 1,
        category,
        location,
        contact_id: selectedContact?.id ?? null,
        contact_name: selectedContact?.name ?? null,
        contact_phone: selectedContact?.phone ?? null,
        contact_email: selectedContact?.email ?? null,
        responsible_name: responsibleName,
        status: "planificada",
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      setError(friendlyError(error));
      return;
    }
    if (data) router.push(`/obras/detalle?id=${data.id}`);
  }

  if (!roleLoading && !canWrite(role)) {
    return (
      <p className="text-sm text-steel border border-dashed border-line rounded-tag px-4 py-6 text-center">
        Tu rol es de solo lectura — no podés crear obras.
      </p>
    );
  }

  return (
    <div className="max-w-xl">
      <header className="mb-8">
        <p className="font-mono text-xs text-steel uppercase tracking-wide">Nuevo registro</p>
        <h1 className="font-display font-bold text-3xl text-ink">Crear obra</h1>
      </header>

      <form onSubmit={handleSubmit} className="bg-panel border border-line rounded-tag shadow-card p-6 space-y-4">
        <Field label="Nombre de la obra" value={name} onChange={setName} placeholder="Ampliación planta norte" required />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cliente" value={client} onChange={setClient} placeholder="Constructora XYZ" />
          <Field label="Ubicación" value={location} onChange={setLocation} placeholder="Zárate, Buenos Aires" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha de inicio" value={startDate} onChange={setStartDate} type="date" />
          <Field label="Fecha límite" value={endDate} onChange={setEndDate} type="date" />
        </div>
        <Field label="Categoría del trabajo" value={category} onChange={setCategory} placeholder="Ej: Ampliación, Techado, Instalación eléctrica..." />
        {historicalAvg !== null && (
          <p className="text-xs text-info bg-info/10 rounded-tag px-3 py-2">
            Obras anteriores terminadas de "{category}" promediaron{" "}
            <span className="font-mono">{formatMoney(historicalAvg, refCurrency)}</span>.
          </p>
        )}

        <div>
          <p className="text-xs text-steel mb-1">Presupuesto</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              className="focus-ring col-span-1 border border-line rounded-tag px-3 py-2 text-sm"
              type="number"
              placeholder="Monto"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
            <select
              className="focus-ring border border-line rounded-tag px-3 py-2 text-sm bg-white"
              value={budgetCurrency}
              onChange={(e) => setBudgetCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <FxRateField amount={budget} currency={budgetCurrency} refCurrency={refCurrency} fxRate={budgetFxRate} onFxRateChange={setBudgetFxRate} />
          </div>
          {budgetCurrency === refCurrency && (
            <p className="text-[11px] text-steel mt-1">Ya está en {refCurrency}, no hace falta cotización.</p>
          )}
        </div>

        <div className="pt-2 border-t border-line">
          <p className="text-xs text-steel uppercase tracking-wide mb-3 mt-3">Contacto del cliente</p>
          {selectedContact ? (
            <div className="flex items-center justify-between border border-line rounded-tag px-3 py-2 bg-base">
              <div>
                <p className="text-sm text-ink">{selectedContact.name}</p>
                <p className="text-xs text-steel">{selectedContact.phone} {selectedContact.email && `· ${selectedContact.email}`}</p>
              </div>
              <button type="button" onClick={() => setSelectedContact(null)} className="focus-ring text-xs text-accent font-mono">
                cambiar
              </button>
            </div>
          ) : (
            <ContactPicker onSelect={setSelectedContact} placeholder="Buscar contacto o escribir uno nuevo..." />
          )}
        </div>

        <div className="pt-2 border-t border-line">
          <p className="text-xs text-steel uppercase tracking-wide mb-3 mt-3">Nuestro equipo</p>
          <label className="block text-xs text-steel">
            Responsable interno de la obra
            <select
              className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm bg-white"
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
            >
              <option value="">Elegir del equipo...</option>
              {team.map((m) => (
                <option key={m.user_id} value={m.name || m.email}>{m.name || m.email}</option>
              ))}
            </select>
            <span className="block mt-1 text-[11px] text-steel/80">
              Después de crear la obra podés sumar más gente — de tu equipo o contactos del
              cliente — desde "Colaboradores", en el detalle de la obra.
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="focus-ring bg-accent text-white text-sm px-5 py-2.5 rounded-tag hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Crear obra"}
        </button>
        <FormError message={error} />
      </form>
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
    <label className="block text-xs text-steel">
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

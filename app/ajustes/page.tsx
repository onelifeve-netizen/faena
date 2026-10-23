"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CURRENCIES } from "@/lib/currency";
import { runMutation } from "@/lib/errors";
import FormError from "@/components/FormError";
import { Company } from "@/lib/types";

export default function Ajustes() {
  const [currency, setCurrency] = useState("USD");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [company, setCompany] = useState<Company | null>(null);
  const [industry, setIndustry] = useState("");
  const [savedIndustry, setSavedIndustry] = useState(false);

  useEffect(() => {
    async function load() {
      const [cur, mail, comp] = await Promise.all([
        supabase.from("settings").select("*").eq("key", "reference_currency").single(),
        supabase.from("settings").select("*").eq("key", "notification_email").maybeSingle(),
        supabase.from("companies").select("id, name, invite_code, industry, created_at").maybeSingle(),
      ]);
      if (cur.data) setCurrency(cur.data.value);
      if (mail.data) setNotifyEmail(mail.data.value);
      if (comp.data) {
        setCompany(comp.data);
        setIndustry(comp.data.industry ?? "");
      }
      setLoading(false);
    }
    load();
  }, []);

  async function save() {
    setError("");
    const ok1 = await runMutation(
      () => supabase.from("settings").upsert({ key: "reference_currency", value: currency }, { onConflict: "company_id,key" }),
      setError
    );
    if (!ok1) return;
    const ok2 = await runMutation(
      () => supabase.from("settings").upsert({ key: "notification_email", value: notifyEmail }, { onConflict: "company_id,key" }),
      setError
    );
    if (!ok2) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function saveIndustry() {
    if (!company) return;
    setError("");
    const ok = await runMutation(
      () => supabase.from("companies").update({ industry: industry.trim() || null }).eq("id", company.id),
      setError
    );
    if (!ok) return;
    setSavedIndustry(true);
    setTimeout(() => setSavedIndustry(false), 2000);
  }

  return (
    <div className="max-w-md">
      <header className="mb-8">
        <p className="font-mono text-xs text-steel uppercase tracking-wide">Configuración del equipo</p>
        <h1 className="font-display font-bold text-3xl text-ink">Ajustes</h1>
        {company && <p className="text-xs text-steel mt-2">Empresa: <span className="text-ink font-medium">{company.name}</span></p>}
      </header>

      <section className="bg-panel border border-line rounded-tag shadow-card p-5">
        <h2 className="font-display font-bold text-sm mb-1">Moneda de referencia</h2>
        <p className="text-xs text-steel mb-4">
          Todos los presupuestos, gastos y pagos —sin importar en qué moneda se pactaron— se
          convierten a esta moneda para poder comparar todo en un mismo valor.
        </p>
        {loading ? (
          <p className="text-sm text-steel">Cargando...</p>
        ) : (
          <div className="flex items-center gap-3">
            <select
              className="focus-ring border border-line rounded-tag px-3 py-2 text-sm bg-white"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button onClick={save} className="focus-ring bg-accent text-white text-sm px-4 py-2 rounded-tag hover:opacity-90">
              Guardar
            </button>
            {saved && <span className="text-xs text-ok">Guardado ✓</span>}
          </div>
        )}
      </section>

      <section className="bg-panel border border-line rounded-tag shadow-card p-5 mt-4">
        <h2 className="font-display font-bold text-sm mb-1">Recordatorios por mail</h2>
        <p className="text-xs text-steel mb-4">
          Todos los días se revisan las obras con plazo vencido o a menos de 3 días, y se manda un
          resumen a esta dirección. Dejalo vacío para desactivar los recordatorios.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="email"
            className="focus-ring flex-1 border border-line rounded-tag px-3 py-2 text-sm"
            placeholder="equipo@empresa.com"
            value={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.value)}
          />
          <button onClick={save} className="focus-ring bg-accent text-white text-sm px-4 py-2 rounded-tag hover:opacity-90 shrink-0">
            Guardar
          </button>
        </div>
        {saved && <span className="text-xs text-ok block mt-2">Guardado ✓</span>}
      </section>

      {company && (
        <section className="bg-panel border border-line rounded-tag shadow-card p-5 mt-4">
          <h2 className="font-display font-bold text-sm mb-1">Rubro / industria</h2>
          <p className="text-xs text-steel mb-4">
            Opcional, solo informativo — no cambia cómo funciona la app, es para identificar a qué
            se dedica tu empresa.
          </p>
          <div className="flex items-center gap-3">
            <input
              className="focus-ring flex-1 border border-line rounded-tag px-3 py-2 text-sm"
              placeholder="Ej: Construcción, Gastronomía, Logística..."
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
            <button onClick={saveIndustry} className="focus-ring bg-accent text-white text-sm px-4 py-2 rounded-tag hover:opacity-90 shrink-0">
              Guardar
            </button>
          </div>
          {savedIndustry && <span className="text-xs text-ok block mt-2">Guardado ✓</span>}
        </section>
      )}

      <FormError message={error} />
    </div>
  );
}

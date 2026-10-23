"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Machine, MachineStatus } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import FormError from "@/components/FormError";
import { logAudit } from "@/lib/audit";
import { runMutation } from "@/lib/errors";
import { CURRENCIES } from "@/lib/currency";
import FxRateField from "@/components/FxRateField";
import DonutChart from "@/components/DonutChart";
import { useMyRole, canWrite } from "@/lib/roles";

const CHART_COLORS = ["#6D28D9", "#F4C430", "#2E86AB", "#E07A5F", "#81B29A", "#A34A22", "#3D5A80"];

export default function Inventario() {
  const { role } = useMyRole();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [serial, setSerial] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseCurrency, setPurchaseCurrency] = useState("ARS");
  const [purchaseFx, setPurchaseFx] = useState("1");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [usefulLife, setUsefulLife] = useState("");
  const [refCurrency, setRefCurrency] = useState("USD");
  const [formError, setFormError] = useState("");
  const [listError, setListError] = useState("");

  async function load() {
    const { data, error } = await supabase.from("machines").select("*").order("created_at", { ascending: false });
    if (error) setListError("No se pudo cargar el inventario. Revisá tu conexión y recargá la página.");
    setMachines(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    supabase.from("settings").select("*").eq("key", "reference_currency").single().then(({ data }) => {
      if (data) setRefCurrency(data.value);
    });
  }, []);

  async function addMachine(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    let newId: string | null = null;
    const ok = await runMutation(
      async () => {
        const { data, error } = await supabase
          .from("machines")
          .insert({
            name,
            category,
            location,
            serial,
            status: "disponible",
            purchase_price: purchasePrice ? Number(purchasePrice) : null,
            purchase_price_currency: purchaseCurrency,
            purchase_price_fx_rate: purchaseFx ? Number(purchaseFx) : 1,
            purchase_date: purchaseDate || null,
            useful_life_years: usefulLife ? Number(usefulLife) : null,
          })
          .select()
          .single();
        newId = data?.id ?? null;
        return { error };
      },
      setFormError
    );
    if (!ok) return;
    if (newId) await logAudit("machine", newId, "creado", `Se agregó "${name}" al inventario`);
    setName("");
    setCategory("");
    setLocation("");
    setSerial("");
    setPurchasePrice("");
    setPurchaseCurrency("ARS");
    setPurchaseFx("1");
    setPurchaseDate("");
    setUsefulLife("");
    setShowForm(false);
    load();
  }

  const locations = Array.from(new Set(machines.map((m) => m.location?.trim()).filter((l): l is string => !!l))).sort();
  const filteredMachines = locationFilter ? machines.filter((m) => m.location === locationFilter) : machines;

  async function changeStatus(id: string, status: MachineStatus, name: string) {
    setListError("");
    const ok = await runMutation(() => supabase.from("machines").update({ status }).eq("id", id), setListError);
    if (!ok) return;
    await logAudit("machine", id, "cambio de estado", `"${name}" pasó a estado "${status}"`);
    load();
  }

  return (
    <div>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-steel uppercase tracking-wide">Maquinaria, herramientas, materiales e insumos</p>
          <h1 className="font-display font-bold text-3xl text-ink">Inventario</h1>
        </div>
        {canWrite(role) && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="focus-ring bg-ink text-white text-sm px-4 py-2 rounded-tag hover:bg-ink/90 transition-colors"
          >
            {showForm ? "Cancelar" : "+ Agregar artículo"}
          </button>
        )}
      </header>

      {showForm && canWrite(role) && (
        <form onSubmit={addMachine} className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Nombre" value={name} onChange={setName} placeholder="Retroexcavadora, andamio, bolsas de cemento..." required />
          <Field label="Categoría" value={category} onChange={setCategory} placeholder="La que uses en tu rubro: Maquinaria, Repuesto, Insumo..." />
          <Field label="Ubicación" value={location} onChange={setLocation} placeholder="Patio, almacén, nave..." />
          <Field label="N.° de serie o código" value={serial} onChange={setSerial} placeholder="Opcional" />
          <div className="col-span-1 sm:col-span-3 pt-3 border-t border-line">
            <p className="text-[11px] text-steel uppercase tracking-wide font-mono mb-2">Compra (opcional — habilita el cálculo de depreciación)</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Precio de compra" value={purchasePrice} onChange={setPurchasePrice} placeholder="Ej: 15000" type="number" />
            <label className="text-xs text-steel">
              Moneda de origen
              <select className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm bg-white" value={purchaseCurrency} onChange={(e) => setPurchaseCurrency(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <FxRateField amount={purchasePrice} currency={purchaseCurrency} refCurrency={refCurrency} fxRate={purchaseFx} onFxRateChange={setPurchaseFx} />
          <Field label="Fecha de compra" value={purchaseDate} onChange={setPurchaseDate} type="date" />
          <Field label="Vida útil (años)" value={usefulLife} onChange={setUsefulLife} placeholder="Ej: 10" type="number" />
          <div className="col-span-1 sm:col-span-3">
            <button type="submit" className="focus-ring bg-accent text-white text-sm px-4 py-2 rounded-tag hover:opacity-90">
              Guardar
            </button>
            <FormError message={formError} />
          </div>
        </form>
      )}

      <FormError message={listError} />

      {!loading && machines.length > 0 && (
        <div className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6 flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs text-steel uppercase tracking-wide font-mono mb-2">Por categoría</p>
            <DonutChart
              segments={Object.entries(
                machines.reduce<Record<string, number>>((acc, m) => {
                  const key = m.category?.trim() || "Sin categoría";
                  acc[key] = (acc[key] ?? 0) + 1;
                  return acc;
                }, {})
              ).map(([label, value], i) => ({ label, value, color: CHART_COLORS[i % CHART_COLORS.length] }))}
              size={110}
            />
          </div>
          {locations.length > 0 && (
            <label className="text-xs text-steel">
              Filtrar por ubicación
              <select
                className="focus-ring mt-1 block border border-line rounded-tag px-3 py-2 text-sm bg-white"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                <option value="">Todas</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-steel text-sm">Cargando...</p>
      ) : machines.length === 0 ? (
        <p className="text-sm text-steel border border-dashed border-line rounded-tag px-4 py-6 text-center">
          No hay artículos cargados todavía. Agregá el primero con el botón de arriba.
        </p>
      ) : filteredMachines.length === 0 ? (
        <p className="text-sm text-steel border border-dashed border-line rounded-tag px-4 py-6 text-center">
          No hay artículos en esa ubicación.
        </p>
      ) : (
        <div className="space-y-2">
          {filteredMachines.map((m) => (
            <div key={m.id} className={`asset-tag status-${m.status} px-5 py-4 flex items-center justify-between`}>
              <Link href={`/inventario/detalle?id=${m.id}`} className="focus-ring">
                <p className="font-medium text-sm text-ink hover:underline">{m.name}</p>
                <p className="text-xs text-steel mt-0.5">
                  {m.category && <span>{m.category} · </span>}
                  {m.location && <span>{m.location} · </span>}
                  <span className="serial">{m.serial || "sin N.° de serie"}</span>
                </p>
              </Link>
              <div className="flex items-center gap-3">
                <StatusBadge status={m.status} />
                {canWrite(role) && (
                  <select
                    className="focus-ring text-xs border border-line rounded-tag px-2 py-1 bg-white"
                    value={m.status}
                    onChange={(e) => changeStatus(m.id, e.target.value as MachineStatus, m.name)}
                  >
                    <option value="disponible">Disponible</option>
                    <option value="en_obra">En obra</option>
                    <option value="mantenimiento">Mantenimiento</option>
                  </select>
                )}
              </div>
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

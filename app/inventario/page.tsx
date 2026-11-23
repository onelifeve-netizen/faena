"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Machine, MachineStatus, Location, ToolCondition, MaintenanceSchedule } from "@/lib/types";
import { DEFAULT_ITEM_TYPES, itemTypeLabel, CONDITION_LABELS, CONDITION_STYLES } from "@/lib/itemTypes";
import ItemTypeGlossary from "@/components/ItemTypeGlossary";
import StatusBadge from "@/components/StatusBadge";
import FormError from "@/components/FormError";
import { logAudit } from "@/lib/audit";
import { runMutation } from "@/lib/errors";
import { CURRENCIES, toReference, formatMoney } from "@/lib/currency";
import FxRateField from "@/components/FxRateField";
import DonutChart from "@/components/DonutChart";
import { IconBox } from "@/components/Icons";
import ExcelImport from "@/components/ExcelImport";
import { useMyRole, canWrite } from "@/lib/roles";
import Modal from "@/components/Modal";

const CHART_COLORS = ["#6D28D9", "#F4C430", "#2E86AB", "#E07A5F", "#81B29A", "#A34A22", "#3D5A80"];

function categoryColor(category: string | null | undefined, categories: string[]) {
  const key = category?.trim() || "Sin categoría";
  const idx = categories.indexOf(key);
  return CHART_COLORS[(idx < 0 ? categories.length : idx) % CHART_COLORS.length];
}

export default function Inventario() {
  const router = useRouter();
  const { role } = useMyRole();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [itemType, setItemType] = useState("equipo");
  const [addingNewType, setAddingNewType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [zones, setZones] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("");
  const [addingNewZone, setAddingNewZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState("");
  const [manageZones, setManageZones] = useState(false);
  const [showCostByZone, setShowCostByZone] = useState(false);
  const [zoneRenames, setZoneRenames] = useState<Record<string, string>>({});
  const [zoneMergeTarget, setZoneMergeTarget] = useState<Record<string, string>>({});
  const [zoneError, setZoneError] = useState("");
  const [jobByMachine, setJobByMachine] = useState<Record<string, { id: string; name: string }>>({});
  const [conditionByMachine, setConditionByMachine] = useState<Record<string, ToolCondition>>({});
  const [thumbByMachine, setThumbByMachine] = useState<Record<string, string>>({});
  const [serial, setSerial] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseCurrency, setPurchaseCurrency] = useState("ARS");
  const [purchaseFx, setPurchaseFx] = useState("1");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [usefulLife, setUsefulLife] = useState("");
  const [refCurrency, setRefCurrency] = useState("USD");
  const [companyId, setCompanyId] = useState("");
  const [serialPhoto, setSerialPhoto] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const [listError, setListError] = useState("");
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState("");
  const [upcomingMaintenance, setUpcomingMaintenance] = useState<MaintenanceSchedule[]>([]);

  async function load() {
    const [machRes, zonesRes, jmRes, condRes, photosRes, schedRes] = await Promise.all([
      supabase.from("machines").select("*, location_obj:locations(*)").order("created_at", { ascending: false }),
      supabase.from("locations").select("*").order("name"),
      supabase.from("job_machines").select("machine_id, job:jobs(id, name)").is("returned_at", null),
      supabase.from("tool_condition_logs").select("machine_id, condition, created_at").order("created_at", { ascending: false }),
      supabase.from("machine_photos").select("machine_id, photo_url").order("created_at", { ascending: false }),
      supabase.from("maintenance_schedules").select("*, machine:machines(*)").eq("active", true).order("next_due_at", { ascending: true }),
    ]);
    if (machRes.error) setListError("No se pudo cargar el inventario. Revisá tu conexión y recargá la página.");
    setMachines((machRes.data as unknown as Machine[]) ?? []);
    setZones((zonesRes.data as Location[]) ?? []);
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    setUpcomingMaintenance(
      ((schedRes.data as MaintenanceSchedule[]) ?? []).filter((s) => s.next_due_at <= in7Days.toISOString().slice(0, 10)).sort((a, b) => a.next_due_at.localeCompare(b.next_due_at))
    );
    const jobMap: Record<string, { id: string; name: string }> = {};
    (jmRes.data ?? []).forEach((r: any) => {
      if (r.job) jobMap[r.machine_id] = r.job;
    });
    setJobByMachine(jobMap);
    const condMap: Record<string, ToolCondition> = {};
    (condRes.data ?? []).forEach((r: any) => {
      if (!condMap[r.machine_id]) condMap[r.machine_id] = r.condition;
    });
    setConditionByMachine(condMap);

    const firstPhotoByMachine: Record<string, string> = {};
    (photosRes.data ?? []).forEach((p: any) => {
      if (!firstPhotoByMachine[p.machine_id]) firstPhotoByMachine[p.machine_id] = p.photo_url;
    });
    const entries = Object.entries(firstPhotoByMachine);
    if (entries.length > 0) {
      const { data: signed } = await supabase.storage.from("inventario-fotos").createSignedUrls(entries.map(([, path]) => path), 3600);
      const thumbMap: Record<string, string> = {};
      (signed ?? []).forEach((s, i) => {
        if (s.signedUrl) thumbMap[entries[i][0]] = s.signedUrl;
      });
      setThumbByMachine(thumbMap);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    supabase.from("settings").select("*").eq("key", "reference_currency").single().then(({ data }) => {
      if (data) setRefCurrency(data.value);
    });
    supabase.from("companies").select("id").maybeSingle().then(({ data }) => {
      if (data) setCompanyId(data.id);
    });
  }, []);

  async function addZone(name: string): Promise<string | null> {
    const trimmed = name.trim();
    const dup = zones.find((z) => z.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (dup) {
      setZoneError(`Ya existe una zona llamada "${dup.name}" — usá esa en vez de crear otra.`);
      return dup.id;
    }
    const { data, error } = await supabase.from("locations").insert({ name: trimmed }).select().single();
    if (error || !data) {
      setZoneError("No se pudo crear la zona.");
      return null;
    }
    await logAudit("location", data.id, "zona creada", trimmed);
    setZones((z) => [...z, data as Location].sort((a, b) => a.name.localeCompare(b.name)));
    return data.id;
  }

  async function renameZone(zone: Location) {
    const newName = (zoneRenames[zone.id] ?? zone.name).trim();
    if (!newName || newName === zone.name) return;
    setZoneError("");
    const ok = await runMutation(() => supabase.from("locations").update({ name: newName }).eq("id", zone.id), setZoneError);
    if (!ok) return;
    await logAudit("location", zone.id, "zona renombrada", `"${zone.name}" → "${newName}"`);
    load();
  }

  async function deleteZone(zone: Location) {
    setZoneError("");
    const ok = await runMutation(() => supabase.from("locations").delete().eq("id", zone.id), setZoneError);
    if (!ok) return;
    await logAudit("location", zone.id, "zona eliminada", zone.name);
    load();
  }

  async function mergeZone(source: Location, targetId: string) {
    setZoneError("");
    const target = zones.find((z) => z.id === targetId);
    if (!target) return;
    const ok1 = await runMutation(() => supabase.from("machines").update({ location_id: targetId }).eq("location_id", source.id), setZoneError);
    if (!ok1) return;
    const ok2 = await runMutation(() => supabase.from("locations").delete().eq("id", source.id), setZoneError);
    if (!ok2) return;
    await logAudit("location", source.id, "zona fusionada", `"${source.name}" → "${target.name}"`);
    load();
  }

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
            item_type: itemType,
            location_id: locationId || null,
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
    if (newId && serialPhoto && companyId) {
      const ext = serialPhoto.name.split(".").pop() || "jpg";
      const path = `${companyId}/${newId}/serial-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("inventario-fotos").upload(path, serialPhoto);
      if (!uploadError) await supabase.from("machines").update({ serial_photo_url: path }).eq("id", newId);
    }
    setName("");
    setCategory("");
    setItemType("equipo");
    setLocationId("");
    setSerial("");
    setSerialPhoto(null);
    setPurchasePrice("");
    setPurchaseCurrency("ARS");
    setPurchaseFx("1");
    setPurchaseDate("");
    setUsefulLife("");
    setShowForm(false);
    load();
  }

  const nameById = new Map(machines.map((m) => [m.id, m.name]));
  const types = Array.from(new Set([...DEFAULT_ITEM_TYPES, ...machines.map((m) => m.item_type?.trim()).filter((t): t is string => !!t)]));
  const filteredMachines = machines
    .filter((m) => !locationFilter || m.location_id === locationFilter)
    .filter((m) => !typeFilter || m.item_type === typeFilter)
    .sort((a, b) => (a.category || "zzz").localeCompare(b.category || "zzz") || a.name.localeCompare(b.name));

  async function changeStatus(id: string, status: MachineStatus, name: string) {
    setListError("");
    const ok = await runMutation(() => supabase.from("machines").update({ status }).eq("id", id), setListError);
    if (!ok) return;
    await logAudit("machine", id, "cambio de estado", `"${name}" pasó a estado "${status}"`);
    load();
  }

  async function deleteAllMachines() {
    if (deleteAllConfirmText.trim().toUpperCase() !== "ELIMINAR TODO") return;
    setListError("");
    const count = machines.length;
    const ok = await runMutation(() => supabase.from("machines").delete().not("id", "is", null), setListError);
    if (!ok) return;
    await logAudit("machine", null, "inventario vaciado", `Se eliminaron ${count} artículo(s) de una sola vez`);
    setShowDeleteAll(false);
    setDeleteAllConfirmText("");
    load();
  }

  return (
    <div>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl text-ink">Inventario</h1>
        </div>
        {canWrite(role) && (
          <div className="flex items-center gap-3">
            <button onClick={() => setShowImport((s) => !s)} className="focus-ring text-xs text-accent font-mono hover:underline">
              {showImport ? "cerrar importación" : "importar desde Excel"}
            </button>
            <button
              onClick={() => setShowForm((s) => !s)}
              className="focus-ring bg-ink text-white text-sm px-4 py-2 rounded-tag hover:bg-ink/90 transition-colors"
            >
              {showForm ? "Cancelar" : "+ Agregar artículo"}
            </button>
            {machines.length > 0 && (
              <button onClick={() => setShowDeleteAll(true)} className="focus-ring text-xs text-warn font-mono hover:underline">
                🗑 eliminar todo
              </button>
            )}
          </div>
        )}
      </header>

      {showDeleteAll && (
        <Modal
          title="Eliminar todo el inventario"
          onClose={() => {
            setShowDeleteAll(false);
            setDeleteAllConfirmText("");
          }}
        >
          <p className="text-sm text-warn font-medium mb-2">
            ⚠ Esto borra los {machines.length} artículo(s) cargados ahora mismo. No se puede deshacer.
          </p>
          <p className="text-sm text-steel mb-3">
            Para confirmar, escribí <span className="font-mono font-medium text-ink">ELIMINAR TODO</span> acá abajo:
          </p>
          <input
            className="focus-ring w-full border border-line rounded-tag px-3 py-2 text-sm mb-3"
            value={deleteAllConfirmText}
            onChange={(e) => setDeleteAllConfirmText(e.target.value)}
            placeholder="ELIMINAR TODO"
          />
          <button
            onClick={deleteAllMachines}
            disabled={deleteAllConfirmText.trim().toUpperCase() !== "ELIMINAR TODO"}
            className="focus-ring w-full bg-warn text-white text-sm font-medium py-2 rounded-tag disabled:opacity-40"
          >
            Sí, eliminar todo el inventario
          </button>
        </Modal>
      )}

      {zones.length === 0 && canWrite(role) && !loading && (
        <div className="bg-info/10 border border-info/20 rounded-tag px-4 py-3 mb-6 flex items-center justify-between gap-3">
          <p className="text-xs text-ink">
            💡 Antes de cargar artículos, te conviene crear tus zonas (ej: "Almacén A", "Patio", "Obra Norte") — así cada artículo queda ubicado desde el inicio.
          </p>
          <button
            onClick={() => setManageZones(true)}
            className="focus-ring text-xs bg-ink text-white px-3 py-1.5 rounded-tag shrink-0"
          >
            crear zonas
          </button>
        </div>
      )}

      {showImport && canWrite(role) && (
        <ExcelImport zones={zones} onDone={load} onClose={() => setShowImport(false)} />
      )}

      {showForm && canWrite(role) && (
        <form onSubmit={addMachine} className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Nombre" value={name} onChange={setName} placeholder="Retroexcavadora, andamio, bolsas de cemento..." required />
          <label className="text-xs text-steel">
            Tipo <ItemTypeGlossary customTypes={types} />
            {addingNewType ? (
              <div className="mt-1 flex gap-1">
                <input
                  className="focus-ring flex-1 border border-line rounded-tag px-3 py-2 text-sm"
                  placeholder="Nombre del tipo nuevo"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newTypeName.trim()) return;
                    setItemType(newTypeName.trim().toLowerCase());
                    setAddingNewType(false);
                    setNewTypeName("");
                  }}
                  className="focus-ring text-xs bg-ink text-white px-2 rounded-tag shrink-0"
                >
                  ok
                </button>
              </div>
            ) : (
              <select
                className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm bg-white"
                value={itemType}
                onChange={(e) => {
                  if (e.target.value === "__nuevo__") setAddingNewType(true);
                  else setItemType(e.target.value);
                }}
              >
                {types.map((t) => <option key={t} value={t}>{itemTypeLabel(t)}</option>)}
                <option value="__nuevo__">+ agregar tipo nuevo...</option>
              </select>
            )}
          </label>
          <Field label="Categoría" value={category} onChange={setCategory} placeholder="La que uses en tu rubro: Maquinaria, Repuesto, Insumo..." />
          <label className="text-xs text-steel">
            Zona / ubicación
            {addingNewZone ? (
              <div className="mt-1 flex gap-1">
                <input
                  className="focus-ring flex-1 border border-line rounded-tag px-3 py-2 text-sm"
                  placeholder="Nombre de la zona nueva"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newZoneName.trim()) return;
                    const newId = await addZone(newZoneName.trim());
                    if (newId) setLocationId(newId);
                    setAddingNewZone(false);
                    setNewZoneName("");
                  }}
                  className="focus-ring text-xs bg-ink text-white px-2 rounded-tag shrink-0"
                >
                  ok
                </button>
              </div>
            ) : (
              <select
                className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm bg-white"
                value={locationId}
                onChange={(e) => {
                  if (e.target.value === "__nuevo__") setAddingNewZone(true);
                  else setLocationId(e.target.value);
                }}
              >
                <option value="">Sin asignar</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                <option value="__nuevo__">+ agregar zona nueva...</option>
              </select>
            )}
          </label>
          <div>
            <Field label="N.° de serie o código" value={serial} onChange={setSerial} placeholder="Opcional — o adjuntá una foto abajo" />
            <label className="focus-ring inline-block mt-1 text-[11px] text-accent font-mono hover:underline cursor-pointer">
              📷 {serialPhoto ? "foto lista para subir" : "adjuntar foto del serial (si es ilegible)"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setSerialPhoto(e.target.files?.[0] ?? null)} />
            </label>
          </div>
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
          <div>
            <Field label="Vida útil (años)" value={usefulLife} onChange={setUsefulLife} placeholder="Ej: 10" type="number" />
            <p className="text-[11px] text-steel/80 mt-1">
              ¿No la sabés? Dejalo en blanco — lo completás después, cuando tengas el dato a mano
              (manual del fabricante, chapa del equipo, etc.).
            </p>
          </div>
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
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <KpiCard label="Artículos (líneas)" value={machines.length.toString()} icon={IconBox} accent="accent" />
            <KpiCard label="Unidades disponibles" value={machines.filter((m) => m.status === "disponible").reduce((s, m) => s + m.quantity, 0).toString()} accent="ok" />
            <KpiCard label="Unidades en obra" value={machines.filter((m) => m.status === "en_obra").reduce((s, m) => s + m.quantity, 0).toString()} accent="info" />
            <KpiCard
              label="Valor total cargado"
              value={formatMoney(
                machines.reduce((sum, m) => sum + (m.purchase_price != null ? toReference(m.purchase_price, m.purchase_price_fx_rate) * m.quantity : 0), 0),
                refCurrency
              )}
              accent="gold"
            />
          </div>

          {Object.values(conditionByMachine).filter((c) => c === "reponer").length > 0 && (
            <div className="bg-warn/10 border border-warn/20 rounded-tag px-4 py-2.5 mb-4 text-xs text-warn">
              ⚠ {Object.values(conditionByMachine).filter((c) => c === "reponer").length} herramienta(s) marcadas como "necesita reposición" — revisalas abajo.
            </div>
          )}

          {upcomingMaintenance.length > 0 && (
            <div className="bg-panel border border-line rounded-tag shadow-card p-4 mb-6">
              <p className="text-xs text-steel uppercase tracking-wide font-mono mb-2">🔧 Mantenimientos próximos (equipos)</p>
              <div className="space-y-1.5">
                {upcomingMaintenance.slice(0, 5).map((s) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const overdue = s.next_due_at < today;
                  return (
                    <Link
                      key={s.id}
                      href={`/inventario/detalle?id=${s.machine_id}`}
                      className="focus-ring flex items-center justify-between text-sm hover:underline"
                    >
                      <span className="text-ink">{s.machine?.name} <span className="text-steel">— {s.name}</span></span>
                      <span className={`badge ${overdue ? "bg-warn/10 text-warn" : "bg-info/10 text-info"}`}>{overdue ? "vencido" : "próximo"} · {s.next_due_at}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-panel border border-line rounded-tag shadow-card p-4 mb-6 flex flex-wrap items-center gap-6">
            <DonutChart
              segments={zones
                .map((z) => ({
                  label: z.name,
                  value: machines.filter((m) => m.location_id === z.id).reduce((s, m) => s + m.quantity, 0),
                  color: categoryColor(z.name, zones.map((zz) => zz.name)),
                }))
                .concat([
                  {
                    label: "Sin zona asignada",
                    value: machines.filter((m) => !m.location_id).reduce((s, m) => s + m.quantity, 0),
                    color: "#C7CBD9",
                  },
                ])}
              size={84}
              onSegmentClick={(label) => {
                if (label === "Sin zona asignada") {
                  setLocationFilter("");
                  return;
                }
                const z = zones.find((zz) => zz.name === label);
                if (z) setLocationFilter(z.id);
              }}
            />
            <div className="flex flex-wrap gap-3 flex-1">
              <label className="text-xs text-steel">
                Tipo
                <select
                  className="focus-ring mt-1 block border border-line rounded-tag px-3 py-1.5 text-sm bg-white"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="">Todos</option>
                  {types.map((t) => <option key={t} value={t}>{itemTypeLabel(t)}</option>)}
                </select>
              </label>
              {zones.length > 0 && (
                <label className="text-xs text-steel">
                  Zona
                  <select
                    className="focus-ring mt-1 block border border-line rounded-tag px-3 py-1.5 text-sm bg-white"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                  >
                    <option value="">Todas</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                </label>
              )}
              {typeFilter && (
                <div className="self-end mb-1.5 text-xs text-steel">
                  {itemTypeLabel(typeFilter)}: <span className="text-ink font-medium">{filteredMachines.reduce((s, m) => s + m.quantity, 0)} unidad(es)</span>
                  {" · "}
                  <span className="text-ink font-medium">
                    {formatMoney(
                      filteredMachines.reduce((sum, m) => sum + (m.purchase_price != null ? toReference(m.purchase_price, m.purchase_price_fx_rate) * m.quantity : 0), 0),
                      refCurrency
                    )}
                  </span>
                </div>
              )}
              {zones.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCostByZone((s) => !s)}
                  className="focus-ring text-xs text-accent font-mono hover:underline self-end mb-1.5"
                >
                  {showCostByZone ? "ocultar costo por zona" : "ver costo por zona"}
                </button>
              )}
              {canWrite(role) && (
                <button
                  type="button"
                  onClick={() => setManageZones((m) => !m)}
                  className="focus-ring text-xs text-accent font-mono hover:underline self-end mb-1.5"
                >
                  {manageZones ? "cerrar gestión de zonas" : "gestionar zonas"}
                </button>
              )}
            </div>
          </div>

          {showCostByZone && zones.length > 0 && (
            <div className="bg-panel border border-line rounded-tag shadow-card p-4 mb-6">
              <p className="text-xs text-steel uppercase tracking-wide font-mono mb-3">Valor de inventario por zona</p>
              <div className="space-y-2">
                {[...zones]
                  .map((z) => {
                    const items = machines.filter((m) => m.location_id === z.id);
                    const units = items.reduce((s, m) => s + m.quantity, 0);
                    const total = items.reduce((sum, m) => sum + (m.purchase_price != null ? toReference(m.purchase_price, m.purchase_price_fx_rate) * m.quantity : 0), 0);
                    return { zone: z, count: items.length, units, total };
                  })
                  .sort((a, b) => b.total - a.total)
                  .map(({ zone, count, units, total }) => (
                    <div key={zone.id} className="flex items-center justify-between text-sm">
                      <span className="text-ink">{zone.name} <span className="text-xs text-steel font-mono">({count} línea{count === 1 ? "" : "s"} · {units} unid.)</span></span>
                      <span className="serial">{formatMoney(total, refCurrency)}</span>
                    </div>
                  ))}
                {(() => {
                  const sinZona = machines.filter((m) => !m.location_id);
                  const units = sinZona.reduce((s, m) => s + m.quantity, 0);
                  const total = sinZona.reduce((sum, m) => sum + (m.purchase_price != null ? toReference(m.purchase_price, m.purchase_price_fx_rate) * m.quantity : 0), 0);
                  return sinZona.length > 0 ? (
                    <div className="flex items-center justify-between text-sm text-steel pt-1 border-t border-line">
                      <span>Sin zona asignada <span className="text-xs font-mono">({sinZona.length} línea{sinZona.length === 1 ? "" : "s"} · {units} unid.)</span></span>
                      <span className="serial">{formatMoney(total, refCurrency)}</span>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          )}

          {manageZones && canWrite(role) && (
            <div className="bg-panel border border-line rounded-tag shadow-card p-4 mb-6">
              <p className="text-xs text-steel uppercase tracking-wide font-mono mb-2">Zonas / módulos</p>
              <FormError message={zoneError} />
              <div className="space-y-1.5 mb-3">
                {zones.map((z) => (
                  <div key={z.id} className="flex items-center gap-2">
                    <input
                      className="focus-ring flex-1 border border-line rounded-tag px-2 py-1 text-sm"
                      value={zoneRenames[z.id] ?? z.name}
                      onChange={(e) => setZoneRenames((r) => ({ ...r, [z.id]: e.target.value }))}
                      onBlur={() => renameZone(z)}
                    />
                    {z.coordinates && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(z.coordinates)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="focus-ring text-xs text-accent font-mono hover:underline shrink-0"
                      >
                        📍 mapa
                      </a>
                    )}
                    <select
                      className="focus-ring text-xs border border-line rounded-tag px-1 py-1 shrink-0"
                      value={zoneMergeTarget[z.id] ?? ""}
                      onChange={(e) => setZoneMergeTarget((r) => ({ ...r, [z.id]: e.target.value }))}
                    >
                      <option value="">fusionar en...</option>
                      {zones.filter((other) => other.id !== z.id).map((other) => (
                        <option key={other.id} value={other.id}>{other.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => (zoneMergeTarget[z.id] ? mergeZone(z, zoneMergeTarget[z.id]) : deleteZone(z))}
                      className="focus-ring text-xs text-warn font-mono hover:underline shrink-0"
                    >
                      {zoneMergeTarget[z.id] ? "fusionar y borrar" : "borrar"}
                    </button>
                  </div>
                ))}
                {zones.length === 0 && <p className="text-xs text-steel">Todavía no hay zonas creadas.</p>}
              </div>
              <div className="flex gap-1">
                <input
                  className="focus-ring flex-1 border border-line rounded-tag px-2 py-1.5 text-sm"
                  placeholder="Nueva zona (ej: Almacén A, Patio sector norte...)"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                />
                <button
                  onClick={async () => {
                    if (!newZoneName.trim()) return;
                    await addZone(newZoneName.trim());
                    setNewZoneName("");
                  }}
                  className="focus-ring text-xs bg-ink text-white px-3 rounded-tag shrink-0"
                >
                  + agregar
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {loading ? (
        <p className="text-steel text-sm">Cargando...</p>
      ) : machines.length === 0 ? (
        <p className="text-sm text-steel border border-dashed border-line rounded-tag px-4 py-6 text-center">
          No hay artículos cargados todavía. Agregá el primero con el botón de arriba.
        </p>
      ) : filteredMachines.length === 0 ? (
        <p className="text-sm text-steel border border-dashed border-line rounded-tag px-4 py-6 text-center">
          No hay artículos que coincidan con esos filtros.
        </p>
      ) : (
        <div className="space-y-6">
          {groupByZone(filteredMachines).map(([groupLabel, items]) => (
            <div key={groupLabel}>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[11px] text-steel uppercase tracking-wide font-mono">
                  {groupLabel} ({items.length} línea{items.length === 1 ? "" : "s"} · {items.reduce((s, m) => s + m.quantity, 0)} unidad(es))
                </p>
              </div>
              <div className="space-y-2">
                {items.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => router.push(`/inventario/detalle?id=${m.id}`)}
                    className={`asset-tag status-${m.status} px-5 py-4 flex items-center gap-4 justify-between cursor-pointer`}
                  >
                    {thumbByMachine[m.id] ? (
                      <img src={thumbByMachine[m.id]} alt="" className="w-12 h-12 rounded-tag object-cover shrink-0 border border-line" />
                    ) : (
                      <div className="w-12 h-12 rounded-tag shrink-0 border border-line bg-base flex items-center justify-center">
                        <IconBox className="text-steel/40" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-ink">{m.name}</p>
                        <span className="badge bg-steel/10 text-steel">{itemTypeLabel(m.item_type)}</span>
                        {conditionByMachine[m.id] && (
                          <span className={`badge ${CONDITION_STYLES[conditionByMachine[m.id]]}`}>{CONDITION_LABELS[conditionByMachine[m.id]]}</span>
                        )}
                      </div>
                      <p className="text-xs text-steel mt-0.5">
                        {m.parent_machine_id && (
                          <span className="text-accent">↳ accesorio de {nameById.get(m.parent_machine_id) ?? "equipo eliminado"} · </span>
                        )}
                        {m.location_obj?.name ? <span>{m.location_obj.name} · </span> : <span className="text-steel/50">sin zona · </span>}
                        <span className="serial">{m.serial || "sin N.° de serie"}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      {m.status === "en_obra" && jobByMachine[m.id] && (
                        <Link href={`/obras/detalle?id=${jobByMachine[m.id].id}`} className="focus-ring text-[11px] text-accent font-mono hover:underline">
                          en obra: {jobByMachine[m.id].name} →
                        </Link>
                      )}
                      <StatusBadge status={m.status} />
                      {canWrite(role) && m.status === "en_obra" ? (
                        <span className="text-[11px] text-steel" title="Para devolverlo, hacelo desde el detalle de la obra">
                          se devuelve desde la obra
                        </span>
                      ) : (
                        canWrite(role) && (
                          <select
                            className="focus-ring text-xs border border-line rounded-tag px-2 py-1 bg-white"
                            value={m.status}
                            onChange={(e) => changeStatus(m.id, e.target.value as MachineStatus, m.name)}
                          >
                            <option value="disponible">Disponible</option>
                            <option value="mantenimiento">Mantenimiento</option>
                          </select>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByZone(machines: Machine[]): [string, Machine[]][] {
  const groups: Record<string, Machine[]> = {};
  for (const m of machines) {
    const key = m.location_obj?.name?.trim() || "Sin zona asignada";
    (groups[key] ??= []).push(m);
  }
  return Object.entries(groups).sort(([a], [b]) => (a === "Sin zona asignada" ? 1 : b === "Sin zona asignada" ? -1 : a.localeCompare(b)));
}

function KpiCard({
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  accent: string;
  icon?: (props: { className?: string }) => React.ReactElement;
}) {
  return (
    <div className="bg-panel border border-line rounded-tag shadow-card px-4 py-4">
      {Icon && (
        <div className={`w-8 h-8 rounded-tag flex items-center justify-center mb-3 bg-${accent}/10`}>
          <Icon className={`text-${accent}`} />
        </div>
      )}
      <p className={`font-display font-bold text-2xl text-${accent}`}>{value}</p>
      <p className="text-xs text-steel mt-1">{label}</p>
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

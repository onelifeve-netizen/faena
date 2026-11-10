"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Machine, WorkOrder, WorkOrderType, WorkOrderPriority, WorkOrderStatus, MaintenanceSchedule, MachineDepreciation, MachineSpec, MachinePhoto, Location, TransferNote, ToolConditionLog, ToolCondition } from "@/lib/types";
import { itemTypeLabel, CONDITION_LABELS, CONDITION_STYLES } from "@/lib/itemTypes";
import StatusBadge from "@/components/StatusBadge";
import DepreciationChart from "@/components/DepreciationChart";
import MachineTimeline from "@/components/MachineTimeline";
import FormError from "@/components/FormError";
import { runMutation, functionErrorMessage } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { useMyRole, canWrite } from "@/lib/roles";

export default function InventarioDetalle() {
  return (
    <Suspense fallback={<p className="text-steel text-sm">Cargando...</p>}>
      <InventarioDetalleInner />
    </Suspense>
  );
}

function InventarioDetalleInner() {
  const { role } = useMyRole();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const [machine, setMachine] = useState<Machine | null>(null);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [depreciation, setDepreciation] = useState<MachineDepreciation | null>(null);
  const [specs, setSpecs] = useState<MachineSpec[]>([]);
  const [specLabel, setSpecLabel] = useState("");
  const [specValue, setSpecValue] = useState("");
  const [specError, setSpecError] = useState("");
  const [loading, setLoading] = useState(true);
  const [readingTag, setReadingTag] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<{ label: string; value: string }[]>([]);
  const [tagError, setTagError] = useState("");
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderTitle, setOrderTitle] = useState("");
  const [orderType, setOrderType] = useState<WorkOrderType>("correctivo");
  const [orderPriority, setOrderPriority] = useState<WorkOrderPriority>("media");
  const [orderDesc, setOrderDesc] = useState("");
  const [orderError, setOrderError] = useState("");
  const [closingOrderId, setClosingOrderId] = useState<string | null>(null);
  const [closeNote, setCloseNote] = useState("");
  const [closeCost, setCloseCost] = useState("");
  const [photos, setPhotos] = useState<MachinePhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [companyId, setCompanyId] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [serialPhotoUrl, setSerialPhotoUrl] = useState<string | null>(null);
  const [uploadingSerialPhoto, setUploadingSerialPhoto] = useState(false);
  const [serialPhotoError, setSerialPhotoError] = useState("");
  const [zones, setZones] = useState<Location[]>([]);
  const [zoneError, setZoneError] = useState("");
  const [currentJob, setCurrentJob] = useState<{ id: string; name: string } | null>(null);
  const [accessories, setAccessories] = useState<Machine[]>([]);
  const [unlinkedMachines, setUnlinkedMachines] = useState<Machine[]>([]);
  const [linkAccessoryId, setLinkAccessoryId] = useState("");
  const [newAccessoryName, setNewAccessoryName] = useState("");
  const [accessoryError, setAccessoryError] = useState("");
  const [transferNotes, setTransferNotes] = useState<TransferNote[]>([]);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferDestination, setTransferDestination] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferError, setTransferError] = useState("");
  const [lastTransferLink, setLastTransferLink] = useState<string | null>(null);
  const [conditionLogs, setConditionLogs] = useState<ToolConditionLog[]>([]);
  const [newCondition, setNewCondition] = useState<ToolCondition>("bueno");
  const [conditionNote, setConditionNote] = useState("");
  const [conditionError, setConditionError] = useState("");

  async function load() {
    const [machRes, ordersRes, schedRes, depRes, specsRes, photosRes, compRes, zonesRes, jmRes, accRes, unlinkedRes, tnRes, condRes] = await Promise.all([
      supabase.from("machines").select("*, location_obj:locations(*)").eq("id", id).single(),
      supabase.from("work_orders").select("*").eq("machine_id", id).order("created_at", { ascending: false }),
      supabase.from("maintenance_schedules").select("*").eq("machine_id", id).order("next_due_at", { ascending: true }),
      supabase.from("machine_depreciation").select("*").eq("machine_id", id).maybeSingle(),
      supabase.from("machine_specs").select("*").eq("machine_id", id).order("created_at", { ascending: true }),
      supabase.from("machine_photos").select("*").eq("machine_id", id).order("created_at", { ascending: false }),
      supabase.from("companies").select("id").maybeSingle(),
      supabase.from("locations").select("*").order("name"),
      supabase.from("job_machines").select("job:jobs(id, name)").eq("machine_id", id).is("returned_at", null).maybeSingle(),
      supabase.from("machines").select("*").eq("parent_machine_id", id).order("name"),
      supabase
        .from("machines")
        .select("*")
        .is("parent_machine_id", null)
        .neq("id", id)
        .in("item_type", ["accesorio", "herramienta", "consumible", "repuesto"])
        .order("name"),
      supabase.from("transfer_notes").select("*").eq("machine_id", id).order("created_at", { ascending: false }),
      supabase.from("tool_condition_logs").select("*").eq("machine_id", id).order("created_at", { ascending: false }),
    ]);
    if (compRes.data) setCompanyId(compRes.data.id);
    setZones((zonesRes.data as Location[]) ?? []);
    setCurrentJob((jmRes.data as any)?.job ?? null);
    setAccessories((accRes.data as Machine[]) ?? []);
    setUnlinkedMachines((unlinkedRes.data as Machine[]) ?? []);
    setTransferNotes((tnRes.data as TransferNote[]) ?? []);
    setConditionLogs((condRes.data as ToolConditionLog[]) ?? []);
    const photoList = (photosRes.data as MachinePhoto[]) ?? [];
    setPhotos(photoList);
    if (photoList.length > 0) {
      const { data: signed } = await supabase.storage
        .from("inventario-fotos")
        .createSignedUrls(photoList.map((p) => p.photo_url), 3600);
      const map: Record<string, string> = {};
      (signed ?? []).forEach((s, i) => {
        if (s.signedUrl) map[photoList[i].id] = s.signedUrl;
      });
      setPhotoUrls(map);
    } else {
      setPhotoUrls({});
    }
    setMachine(machRes.data);
    if (machRes.data?.serial_photo_url) {
      const { data: signed } = await supabase.storage.from("inventario-fotos").createSignedUrl(machRes.data.serial_photo_url, 3600);
      setSerialPhotoUrl(signed?.signedUrl ?? null);
    } else {
      setSerialPhotoUrl(null);
    }
    setOrders(ordersRes.data ?? []);
    setSchedules(schedRes.data ?? []);
    setDepreciation((depRes.data as MachineDepreciation) ?? null);
    setSpecs((specsRes.data as MachineSpec[]) ?? []);
    setLoading(false);
  }

  async function addSpec(e: React.FormEvent) {
    e.preventDefault();
    if (!specLabel.trim() || !specValue.trim()) return;
    const ok = await runMutation(
      () => supabase.from("machine_specs").insert({ machine_id: id, label: specLabel.trim(), value: specValue.trim() }),
      setSpecError
    );
    if (!ok) return;
    await logAudit("machine_spec", id, "especificación agregada", `${specLabel.trim()}: ${specValue.trim()}`);
    setSpecLabel("");
    setSpecValue("");
    load();
  }

  async function removeSpec(spec: MachineSpec) {
    setSpecError("");
    const ok = await runMutation(() => supabase.from("machine_specs").delete().eq("id", spec.id), setSpecError);
    if (!ok) return;
    await logAudit("machine_spec", id, "especificación quitada", `${spec.label}: ${spec.value}`);
    load();
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function addPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !companyId) return;
    setPhotoError("");
    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${companyId}/${id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("inventario-fotos").upload(path, file);
      if (uploadError) {
        setPhotoError("No se pudo subir la foto.");
        return;
      }
      const ok = await runMutation(() => supabase.from("machine_photos").insert({ machine_id: id, photo_url: path }), setPhotoError);
      if (!ok) return;
      await logAudit("machine_photo", id, "foto agregada", `Foto agregada a "${machine?.name}"`);
      load();
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function uploadSerialPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !companyId) return;
    setSerialPhotoError("");
    setUploadingSerialPhoto(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${companyId}/${id}/serial-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("inventario-fotos").upload(path, file);
      if (uploadError) {
        setSerialPhotoError("No se pudo subir la foto.");
        return;
      }
      const ok = await runMutation(() => supabase.from("machines").update({ serial_photo_url: path }).eq("id", id), setSerialPhotoError);
      if (!ok) return;
      load();
    } finally {
      setUploadingSerialPhoto(false);
    }
  }

  async function changeZone(zoneId: string) {
    setZoneError("");
    const ok = await runMutation(() => supabase.from("machines").update({ location_id: zoneId || null }).eq("id", id), setZoneError);
    if (!ok) return;
    const zoneName = zones.find((z) => z.id === zoneId)?.name ?? "sin zona";
    await logAudit("machine", id, "zona cambiada", `"${machine?.name}" → ${zoneName}`);
    load();
  }

  async function linkAccessory() {
    if (!linkAccessoryId) return;
    setAccessoryError("");
    const ok = await runMutation(() => supabase.from("machines").update({ parent_machine_id: id }).eq("id", linkAccessoryId), setAccessoryError);
    if (!ok) return;
    const accName = unlinkedMachines.find((m) => m.id === linkAccessoryId)?.name ?? "";
    await logAudit("machine", linkAccessoryId, "vinculado como accesorio", `"${accName}" vinculado a "${machine?.name}"`);
    setLinkAccessoryId("");
    load();
  }

  async function createAccessory(e: React.FormEvent) {
    e.preventDefault();
    if (!newAccessoryName.trim()) return;
    setAccessoryError("");
    const ok = await runMutation(
      () =>
        supabase.from("machines").insert({
          name: newAccessoryName.trim(),
          item_type: "accesorio",
          status: machine?.status ?? "disponible",
          location_id: machine?.location_id ?? null,
          parent_machine_id: id,
        }),
      setAccessoryError
    );
    if (!ok) return;
    await logAudit("machine", id, "accesorio creado", `"${newAccessoryName.trim()}" creado para "${machine?.name}"`);
    setNewAccessoryName("");
    load();
  }

  async function unlinkAccessory(acc: Machine) {
    setAccessoryError("");
    const ok = await runMutation(() => supabase.from("machines").update({ parent_machine_id: null }).eq("id", acc.id), setAccessoryError);
    if (!ok) return;
    await logAudit("machine", acc.id, "desvinculado de equipo", `"${acc.name}" ya no depende de "${machine?.name}"`);
    load();
  }

  async function createTransferNote(e: React.FormEvent) {
    e.preventDefault();
    if (!transferDestination.trim()) return;
    setTransferError("");
    const fromLocation = currentJob ? `Obra: ${currentJob.name}` : machine?.location_obj?.name ?? null;
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("transfer_notes")
      .insert({
        machine_id: id,
        from_location: fromLocation,
        to_location: transferDestination.trim(),
        note: transferNote || null,
        created_by_email: userData?.user?.email ?? null,
      })
      .select()
      .single();
    if (error || !data) {
      setTransferError("No se pudo generar la guía.");
      return;
    }
    await logAudit("machine", id, "guía de traslado generada", `"${machine?.name}" → ${transferDestination.trim()}`);
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    setLastTransferLink(`${window.location.origin}${base}/guia?token=${data.share_token}`);
    setTransferDestination("");
    setTransferNote("");
    setShowTransferForm(false);
    load();
  }

  async function deleteTransferNote(note: TransferNote) {
    if (!confirm("¿Anular esta guía de traslado? El link público dejará de funcionar.")) return;
    setTransferError("");
    const ok = await runMutation(() => supabase.from("transfer_notes").delete().eq("id", note.id), setTransferError);
    if (!ok) return;
    await logAudit("machine", id, "guía de traslado anulada", `"${machine?.name}" → ${note.to_location}`);
    load();
  }

  async function logCondition(e: React.FormEvent) {
    e.preventDefault();
    setConditionError("");
    const { data: userData } = await supabase.auth.getUser();
    const ok = await runMutation(
      () =>
        supabase.from("tool_condition_logs").insert({
          machine_id: id,
          condition: newCondition,
          note: conditionNote || null,
          logged_by_email: userData?.user?.email ?? null,
        }),
      setConditionError
    );
    if (!ok) return;
    await logAudit("machine", id, "estado registrado", `"${machine?.name}" → ${CONDITION_LABELS[newCondition]}`);
    setConditionNote("");
    load();
  }

  async function removePhoto(photo: MachinePhoto) {
    setPhotoError("");
    await supabase.storage.from("inventario-fotos").remove([photo.photo_url]);
    const ok = await runMutation(() => supabase.from("machine_photos").delete().eq("id", photo.id), setPhotoError);
    if (!ok) return;
    await logAudit("machine_photo", id, "foto quitada", `Foto quitada de "${machine?.name}"`);
    load();
  }

  async function addOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!orderTitle.trim()) return;
    const ok = await runMutation(
      () =>
        supabase.from("work_orders").insert({
          machine_id: id,
          type: orderType,
          title: orderTitle,
          description: orderDesc || null,
          priority: orderPriority,
        }),
      setOrderError
    );
    if (!ok) return;
    await logAudit("work_order", id, "orden creada", `"${orderTitle}" (${orderType}) para ${machine?.name}`);
    setOrderTitle("");
    setOrderDesc("");
    setOrderType("correctivo");
    setOrderPriority("media");
    setShowOrderForm(false);
    load();
  }

  async function setOrderStatus(order: WorkOrder, status: WorkOrderStatus) {
    if (status === "cerrada") {
      setClosingOrderId(order.id);
      return;
    }
    setOrderError("");
    const ok = await runMutation(() => supabase.from("work_orders").update({ status }).eq("id", order.id), setOrderError);
    if (!ok) return;
    await logAudit("work_order", order.id, "cambio de estado", `"${order.title}" pasó a "${status}"`);
    load();
  }

  async function closeOrder(order: WorkOrder) {
    setOrderError("");
    const ok = await runMutation(
      () =>
        supabase
          .from("work_orders")
          .update({
            status: "cerrada",
            closed_at: new Date().toISOString(),
            closed_note: closeNote || null,
            cost: closeCost ? Number(closeCost) : null,
          })
          .eq("id", order.id),
      setOrderError
    );
    if (!ok) return;
    await logAudit("work_order", order.id, "orden cerrada", `"${order.title}" cerrada${closeCost ? ` — costo ${closeCost}` : ""}`);
    setClosingOrderId(null);
    setCloseNote("");
    setCloseCost("");
    load();
  }


  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleTagPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setTagError("");
    setTagSuggestions([]);
    setReadingTag(true);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("leer-chapa", {
        body: { image_base64: base64, media_type: file.type || "image/jpeg" },
      });
      if (error) {
        setTagError(await functionErrorMessage(error, "No se pudo leer la chapa automáticamente. Cargá las especificaciones a mano."));
      } else if (!data || data.error || !Array.isArray(data.specs)) {
        setTagError(data?.error ?? "No se pudo leer la chapa automáticamente. Cargá las especificaciones a mano.");
      } else if (data.specs.length === 0) {
        setTagError("No se detectó texto legible en la foto.");
      } else {
        setTagSuggestions(data.specs);
      }
    } catch {
      setTagError("No se pudo leer la chapa automáticamente. Cargá las especificaciones a mano.");
    } finally {
      setReadingTag(false);
    }
  }

  if (loading) return <p className="text-steel text-sm">Cargando...</p>;
  if (!machine) return <p className="text-steel text-sm">No se encontró el equipo.</p>;

  return (
    <div className="max-w-6xl">
      <Link href="/inventario" className="focus-ring inline-flex items-center gap-1 text-xs text-steel font-mono hover:text-accent hover:underline mb-3">
        ← volver a Inventario
      </Link>
      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-steel uppercase tracking-wide">
            {itemTypeLabel(machine.item_type)}{machine.category && ` · ${machine.category}`}
          </p>
          <h1 className="font-display font-bold text-3xl text-ink">{machine.name}</h1>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {machine.status === "en_obra" && currentJob ? (
              <Link href={`/obras/detalle?id=${currentJob.id}`} className="focus-ring badge bg-info/10 text-info hover:underline">
                en obra: {currentJob.name} →
              </Link>
            ) : canWrite(role) ? (
              <select
                className="focus-ring text-xs border border-line rounded-tag px-2 py-1 bg-white"
                value={machine.location_id ?? ""}
                onChange={(e) => changeZone(e.target.value)}
              >
                <option value="">Sin zona asignada</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            ) : (
              <span className="text-xs text-steel">{machine.location_obj?.name ?? "sin zona asignada"}</span>
            )}
          </div>
          {zoneError && <p className="text-[11px] text-warn mt-0.5">{zoneError}</p>}

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <p className="serial">{machine.serial || "sin N.° de serie"}</p>
            {serialPhotoUrl && (
              <a href={serialPhotoUrl} target="_blank" rel="noreferrer" className="focus-ring text-xs text-accent font-mono hover:underline">
                📷 ver foto del serial
              </a>
            )}
            {canWrite(role) && (
              <label className="focus-ring text-xs text-accent font-mono hover:underline cursor-pointer">
                {uploadingSerialPhoto ? "subiendo..." : serialPhotoUrl ? "reemplazar foto" : "+ adjuntar foto del serial"}
                <input type="file" accept="image/*" className="hidden" onChange={uploadSerialPhoto} disabled={uploadingSerialPhoto} />
              </label>
            )}
          </div>
          {serialPhotoError && <p className="text-[11px] text-warn mt-0.5">{serialPhotoError}</p>}
        </div>
        <StatusBadge status={machine.status} />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
      <div className="lg:col-span-3 space-y-6">

      {/* Fotos */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-sm">Fotos</h2>
          {canWrite(role) && (
            <label className="focus-ring text-xs text-accent font-mono hover:underline cursor-pointer">
              {uploadingPhoto ? "Subiendo..." : "+ agregar foto"}
              <input type="file" accept="image/*" className="hidden" onChange={addPhoto} disabled={uploadingPhoto} />
            </label>
          )}
        </div>
        <FormError message={photoError} />
        {photos.length === 0 ? (
          <p className="text-sm text-steel">Sin fotos cargadas todavía.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative group">
                {photoUrls[p.id] ? (
                  <img src={photoUrls[p.id]} alt="" className="w-full aspect-square object-cover rounded-tag border border-line" />
                ) : (
                  <div className="w-full aspect-square bg-base rounded-tag border border-line" />
                )}
                {canWrite(role) && (
                  <button
                    onClick={() => removePhoto(p)}
                    className="focus-ring absolute top-1 right-1 bg-ink/70 text-white text-[10px] px-1.5 py-0.5 rounded-tag opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    quitar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ficha técnica / especificaciones */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5">
        <h2 className="font-display font-bold text-sm mb-1">Especificaciones técnicas</h2>
        <p className="text-xs text-steel mb-3">
          Datos que querés tener siempre a mano sin buscarlos en un manual: tipo de aceite, modelo
          de filtro, n.° de serie de una pieza, lo que necesites para este equipo.
        </p>
        {specs.length === 0 ? (
          <p className="text-sm text-steel mb-3">Todavía no cargaste especificaciones.</p>
        ) : (
          <div className="space-y-1.5 mb-3">
            {specs.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm border-b border-line pb-1.5">
                <span><span className="text-steel">{s.label}:</span> <span className="text-ink">{s.value}</span></span>
                {canWrite(role) && (
                  <button onClick={() => removeSpec(s)} className="focus-ring text-xs text-warn font-mono hover:underline">
                    quitar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {canWrite(role) && (
          <>
            <label className="focus-ring inline-flex items-center gap-1.5 text-xs text-accent font-mono hover:underline mb-2 cursor-pointer">
              📷 {readingTag ? "Leyendo chapa..." : "Leer chapa/matrícula con IA"}
              <input type="file" accept="image/*" className="hidden" onChange={handleTagPhoto} disabled={readingTag} />
            </label>
            {tagError && <p className="text-[11px] text-warn mb-2">{tagError}</p>}
            {tagSuggestions.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {tagSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setSpecLabel(s.label); setSpecValue(s.value); }}
                    className="focus-ring text-[11px] bg-info/10 text-info px-2 py-1 rounded-tag hover:opacity-80"
                  >
                    {s.label}: {s.value}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={addSpec} className="flex gap-2">
              <input
                className="focus-ring flex-1 border border-line rounded-tag px-3 py-1.5 text-sm"
                placeholder="Etiqueta (ej: Filtro de aceite)"
                value={specLabel}
                onChange={(e) => setSpecLabel(e.target.value)}
              />
              <input
                className="focus-ring flex-1 border border-line rounded-tag px-3 py-1.5 text-sm"
                placeholder="Valor (ej: Mann W940)"
                value={specValue}
                onChange={(e) => setSpecValue(e.target.value)}
              />
              <button className="focus-ring bg-accent text-white text-sm px-4 py-1.5 rounded-tag hover:opacity-90 shrink-0">
                Agregar
              </button>
            </form>
          </>
        )}
        <FormError message={specError} />
      </section>

      {/* Guía de traslado */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-bold text-sm">Guía de traslado</h2>
          {canWrite(role) && !showTransferForm && (
            <button onClick={() => setShowTransferForm(true)} className="focus-ring text-xs text-accent font-mono hover:underline">
              + generar guía
            </button>
          )}
        </div>
        <p className="text-xs text-steel mb-3">
          Comprobante de traslado con el nombre de tu empresa, para compartir con quien lo necesite
          (transportista, cliente) sin que tenga que entrar al sistema.
        </p>

        {showTransferForm && canWrite(role) && (
          <form onSubmit={createTransferNote} className="bg-base rounded-tag p-3 space-y-2 mb-3">
            <input
              className="focus-ring w-full border border-line rounded-tag px-3 py-1.5 text-sm"
              placeholder="Destino (ej: Obra Ampliación Norte, Depósito del cliente...)"
              value={transferDestination}
              onChange={(e) => setTransferDestination(e.target.value)}
              required
              autoFocus
            />
            <input
              className="focus-ring w-full border border-line rounded-tag px-3 py-1.5 text-sm"
              placeholder="Observación (opcional)"
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
            />
            <div className="flex gap-2">
              <button className="focus-ring bg-ink text-white text-xs px-3 py-1.5 rounded-tag">Generar guía</button>
              <button type="button" onClick={() => setShowTransferForm(false)} className="focus-ring text-xs text-steel font-mono">
                cancelar
              </button>
            </div>
          </form>
        )}
        <FormError message={transferError} />

        {lastTransferLink && (
          <div className="bg-ok/10 text-ok text-xs rounded-tag px-3 py-2 mb-3 flex items-center justify-between gap-2">
            <span className="truncate">{lastTransferLink}</span>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => navigator.clipboard.writeText(lastTransferLink)}
                className="focus-ring font-mono hover:underline"
              >
                copiar
              </button>
              <a href={lastTransferLink} target="_blank" rel="noreferrer" className="focus-ring font-mono hover:underline">
                abrir
              </a>
            </div>
          </div>
        )}

        {transferNotes.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-steel uppercase tracking-wide font-mono mb-1">Historial</p>
            {transferNotes.map((t) => {
              const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
              const link = `${typeof window !== "undefined" ? window.location.origin : ""}${base}/guia?token=${t.share_token}`;
              return (
                <div key={t.id} className="flex items-center justify-between text-xs border-b border-line pb-1.5">
                  <span className="text-steel">
                    {t.from_location ?? "origen sin registrar"} → <span className="text-ink">{t.to_location}</span>
                    {" · "}
                    {new Date(t.created_at).toLocaleDateString("es-AR")}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <a href={link} target="_blank" rel="noreferrer" className="focus-ring text-accent font-mono hover:underline">
                      ver →
                    </a>
                    {canWrite(role) && (
                      <button onClick={() => deleteTransferNote(t)} className="focus-ring text-steel font-mono hover:text-warn hover:underline">
                        anular
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Accesorios */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-bold text-sm">Accesorios</h2>
          {accessories.length > 0 && (
            <span className="serial">
              {accessories.filter((a) => a.status === "disponible").length} disponibles / {accessories.length} en total
            </span>
          )}
        </div>
        <p className="text-xs text-steel mb-3">
          Equipos que van siempre junto a este (baldes, palas, acoples...). Al asignar o devolver este
          equipo de una obra, se puede incluirlos.
        </p>
        {accessories.length === 0 ? (
          <p className="text-sm text-steel mb-3">Sin accesorios vinculados todavía.</p>
        ) : (
          <div className="space-y-1.5 mb-3">
            {accessories.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm border-b border-line pb-1.5">
                <Link href={`/inventario/detalle?id=${a.id}`} className="focus-ring hover:underline">
                  {a.name}
                </Link>
                <div className="flex items-center gap-2">
                  <StatusBadge status={a.status} />
                  {canWrite(role) && (
                    <button onClick={() => unlinkAccessory(a)} className="focus-ring text-xs text-warn font-mono hover:underline">
                      desvincular
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {canWrite(role) && (
          <>
            <div className="flex gap-2 mb-2">
              <select
                className="focus-ring flex-1 border border-line rounded-tag px-3 py-1.5 text-sm bg-white"
                value={linkAccessoryId}
                onChange={(e) => setLinkAccessoryId(e.target.value)}
              >
                <option value="">Vincular artículo ya cargado...</option>
                {unlinkedMachines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button onClick={linkAccessory} disabled={!linkAccessoryId} className="focus-ring text-xs bg-ink text-white px-3 rounded-tag disabled:opacity-40 shrink-0">
                vincular
              </button>
            </div>
            <form onSubmit={createAccessory} className="flex gap-2">
              <input
                className="focus-ring flex-1 border border-line rounded-tag px-3 py-1.5 text-sm"
                placeholder="O creá un accesorio nuevo (ej: balde 80cm)"
                value={newAccessoryName}
                onChange={(e) => setNewAccessoryName(e.target.value)}
              />
              <button className="focus-ring text-xs bg-accent text-white px-3 rounded-tag shrink-0">+ crear</button>
            </form>
          </>
        )}
        <FormError message={accessoryError} />
      </section>

      {/* Estado y desgaste */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-bold text-sm">Estado y desgaste</h2>
          {conditionLogs[0] && (
            <span className={`badge ${CONDITION_STYLES[conditionLogs[0].condition]}`}>{CONDITION_LABELS[conditionLogs[0].condition]}</span>
          )}
        </div>
        <p className="text-xs text-steel mb-3">
          Lo registra quien usa el equipo, para saber si hace falta reponerlo sin esperar a que se rompa del todo.
        </p>
        {canWrite(role) && (
          <form onSubmit={logCondition} className="flex flex-col sm:flex-row gap-2 mb-3">
            <select
              className="focus-ring border border-line rounded-tag px-3 py-1.5 text-sm bg-white"
              value={newCondition}
              onChange={(e) => setNewCondition(e.target.value as ToolCondition)}
            >
              <option value="bueno">Bueno</option>
              <option value="regular">Regular</option>
              <option value="malo">Malo</option>
              <option value="reponer">Necesita reposición</option>
            </select>
            <input
              className="focus-ring flex-1 border border-line rounded-tag px-3 py-1.5 text-sm"
              placeholder="Nota (opcional, ej: corta mal, cable pelado...)"
              value={conditionNote}
              onChange={(e) => setConditionNote(e.target.value)}
            />
            <button className="focus-ring bg-ink text-white text-sm px-4 py-1.5 rounded-tag shrink-0">Registrar</button>
          </form>
        )}
        <FormError message={conditionError} />
        {conditionLogs.length === 0 ? (
          <p className="text-sm text-steel">Sin registros de estado todavía.</p>
        ) : (
          <div className="space-y-1.5">
            {conditionLogs.slice(0, 8).map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs border-b border-line pb-1.5">
                <span className="text-steel">
                  <span className={`badge ${CONDITION_STYLES[c.condition]} mr-1.5`}>{CONDITION_LABELS[c.condition]}</span>
                  {c.note && <span>{c.note} — </span>}
                  {new Date(c.created_at).toLocaleDateString("es-AR")}
                </span>
                {c.logged_by_email && <span className="text-steel/70 font-mono shrink-0">{c.logged_by_email}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      </div>
      <div className="lg:col-span-2 space-y-6">

      {/* Línea de tiempo del equipo */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5">
        <h2 className="font-display font-bold text-sm mb-1">Línea de tiempo del equipo</h2>
        {machine.purchase_date ? (
          <>
            <p className="text-[11px] text-steel font-mono mb-3">
              Compra → mantenimientos realizados → hoy → próximo preventivo → fin de vida útil estimado.
            </p>
            <MachineTimeline
              purchaseDate={machine.purchase_date}
              usefulLifeYears={machine.useful_life_years}
              orders={orders}
              schedules={schedules}
            />
          </>
        ) : (
          <p className="text-xs text-steel">
            Sin fecha de compra cargada — no se puede armar la línea de tiempo. Editalo desde Inventario.
          </p>
        )}
      </section>

      {/* Depreciación e inversión */}
      {depreciation?.purchase_price != null && depreciation.purchase_price_ref != null ? (
        <section className="bg-panel border border-line rounded-tag shadow-card p-5">
          <h2 className="font-display font-bold text-sm mb-1">Depreciación e inversión</h2>
          <p className="text-[11px] text-steel font-mono mb-4">
            Método lineal: valor de compra ÷ vida útil en años. Comprado en {formatNumber(depreciation.purchase_price)} {depreciation.purchase_price_currency}, convertido acá a tu moneda de referencia.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <DepStat label="Valor de compra" value={formatNumber(depreciation.purchase_price_ref)} />
            <DepStat label="Depreciación anual" value={depreciation.annual_depreciation != null ? formatNumber(depreciation.annual_depreciation) : "—"} />
            <DepStat label="Valor en libros hoy" value={depreciation.book_value != null ? formatNumber(depreciation.book_value) : "—"} />
            <DepStat label="Gasto de mantenimiento acumulado" value={formatNumber(depreciation.maintenance_cost_total)} tone={depreciation.maintenance_cost_total > depreciation.purchase_price_ref * 0.3 ? "warn" : undefined} />
          </div>
          {depreciation.useful_life_years && depreciation.years_elapsed != null && (
            <DepreciationChart
              purchasePrice={depreciation.purchase_price_ref}
              usefulLifeYears={depreciation.useful_life_years}
              yearsElapsed={depreciation.years_elapsed}
            />
          )}
          {depreciation.book_value != null && depreciation.maintenance_cost_total > depreciation.book_value && (
            <p className="text-xs text-warn mt-3">
              El mantenimiento acumulado ya superó el valor en libros del equipo — evaluar si conviene seguir reparando o reemplazarlo.
            </p>
          )}
        </section>
      ) : (
        <section className="bg-panel border border-dashed border-line rounded-tag shadow-card p-5">
          <p className="text-xs text-steel">
            Sin datos de compra cargados — no se puede calcular depreciación ni comparar contra el gasto de mantenimiento.
            Editalo desde Inventario para agregar precio, fecha de compra y vida útil.
          </p>
        </section>
      )}

      {/* Mantenimiento preventivo programado */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5">
        <h2 className="font-display font-bold text-sm mb-3">Mantenimiento preventivo</h2>
        {schedules.length === 0 ? (
          <p className="text-sm text-steel">Sin reglas programadas para este equipo.</p>
        ) : (
          <div className="space-y-2">
            {schedules.map((s) => (
              <div key={s.id} className="flex justify-between text-sm border-b border-line pb-1">
                <span>{s.name} · cada {s.frequency_days} días</span>
                <span className="serial">próximo: {s.next_due_at}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Órdenes de trabajo del equipo */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-bold text-sm">Órdenes de trabajo</h2>
          {canWrite(role) && (
            <button onClick={() => setShowOrderForm((s) => !s)} className="focus-ring text-xs text-accent font-mono hover:underline">
              {showOrderForm ? "cancelar" : "+ nueva orden"}
            </button>
          )}
        </div>
        <p className="text-xs text-steel mb-3">Correctivos, inspecciones y emergencias de este equipo — lo preventivo se programa desde Mantenimiento.</p>

        {showOrderForm && canWrite(role) && (
          <form onSubmit={addOrder} className="mb-4 bg-base rounded-tag p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              className="focus-ring sm:col-span-2 border border-line rounded-tag px-3 py-1.5 text-sm"
              placeholder="Título (ej: pierde presión al arrancar)"
              value={orderTitle}
              onChange={(e) => setOrderTitle(e.target.value)}
              required
            />
            <select className="focus-ring border border-line rounded-tag px-3 py-1.5 text-sm bg-white" value={orderType} onChange={(e) => setOrderType(e.target.value as WorkOrderType)}>
              <option value="correctivo">Correctivo</option>
              <option value="inspeccion">Inspección</option>
              <option value="emergencia">Emergencia</option>
            </select>
            <select className="focus-ring border border-line rounded-tag px-3 py-1.5 text-sm bg-white" value={orderPriority} onChange={(e) => setOrderPriority(e.target.value as WorkOrderPriority)}>
              <option value="baja">Prioridad baja</option>
              <option value="media">Prioridad media</option>
              <option value="alta">Prioridad alta</option>
            </select>
            <textarea
              className="focus-ring sm:col-span-2 border border-line rounded-tag px-3 py-1.5 text-sm"
              placeholder="Descripción (opcional)"
              value={orderDesc}
              onChange={(e) => setOrderDesc(e.target.value)}
              rows={2}
            />
            <button className="focus-ring sm:col-span-2 bg-ink text-white text-sm py-1.5 rounded-tag">Crear orden</button>
          </form>
        )}
        <FormError message={orderError} />

        {orders.length === 0 ? (
          <p className="text-sm text-steel">Sin órdenes de trabajo registradas todavía.</p>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="border-b border-line pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{o.title}</span>
                  <StatusBadge status={o.status} />
                </div>
                <p className="text-xs text-steel mt-0.5">
                  {o.type} · {new Date(o.created_at).toLocaleDateString("es-AR")}
                  {o.cost ? ` · costo ${o.cost}` : ""}
                </p>
                {o.closed_note && <p className="text-xs text-steel mt-0.5">{o.closed_note}</p>}

                {canWrite(role) && o.status !== "cerrada" && closingOrderId !== o.id && (
                  <div className="flex gap-2 mt-1.5">
                    {o.status === "pendiente" && (
                      <button onClick={() => setOrderStatus(o, "en_curso")} className="focus-ring text-xs text-accent font-mono hover:underline">
                        iniciar
                      </button>
                    )}
                    <button onClick={() => setOrderStatus(o, "cerrada")} className="focus-ring text-xs text-ok font-mono hover:underline">
                      cerrar
                    </button>
                  </div>
                )}

                {closingOrderId === o.id && (
                  <div className="mt-1.5 space-y-2 bg-base rounded-tag p-2">
                    <input
                      className="focus-ring w-full border border-line rounded-tag px-2 py-1 text-xs"
                      placeholder="Nota de cierre (qué se hizo)"
                      value={closeNote}
                      onChange={(e) => setCloseNote(e.target.value)}
                    />
                    <input
                      className="focus-ring w-full border border-line rounded-tag px-2 py-1 text-xs"
                      placeholder="Costo (opcional)"
                      type="number"
                      value={closeCost}
                      onChange={(e) => setCloseCost(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => closeOrder(o)} className="focus-ring bg-ink text-white text-xs px-3 py-1 rounded-tag">
                        Confirmar cierre
                      </button>
                      <button onClick={() => setClosingOrderId(null)} className="focus-ring text-xs text-steel font-mono">
                        cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      </div>
      </div>
    </div>
  );
}

function formatNumber(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function DepStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-base rounded-tag px-3 py-2">
      <p className={`font-display font-bold text-sm ${tone ? `text-${tone}` : "text-ink"}`}>{value}</p>
      <p className="text-[11px] text-steel mt-0.5">{label}</p>
    </div>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Job, JobExpense, JobMachine, JobLogEntry, Machine, JobStatus, JobWorker, Contact, JobPayment, JobInvoice, JobWip, WorkOrder } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import ContactPicker from "@/components/ContactPicker";
import { CURRENCIES, toReference, formatMoney } from "@/lib/currency";
import FxRateField from "@/components/FxRateField";
import { logAudit } from "@/lib/audit";
import { runMutation } from "@/lib/errors";
import FormError from "@/components/FormError";
import { useMyRole, canWrite } from "@/lib/roles";

export default function ObraDetalle() {
  return (
    <Suspense fallback={<p className="text-steel text-sm">Cargando...</p>}>
      <ObraDetalleInner />
    </Suspense>
  );
}

function ObraDetalleInner() {
  const { role } = useMyRole();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const [job, setJob] = useState<Job | null>(null);
  const [expenses, setExpenses] = useState<JobExpense[]>([]);
  const [assigned, setAssigned] = useState<JobMachine[]>([]);
  const [availableMachines, setAvailableMachines] = useState<Machine[]>([]);
  const [log, setLog] = useState<JobLogEntry[]>([]);
  const [workers, setWorkers] = useState<JobWorker[]>([]);
  const [openWorker, setOpenWorker] = useState<string | null>(null);
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [pickedContact, setPickedContact] = useState<Contact | null>(null);
  const [wRole, setWRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<JobPayment[]>([]);
  const [invoices, setInvoices] = useState<JobInvoice[]>([]);
  const [relatedOrders, setRelatedOrders] = useState<WorkOrder[]>([]);
  const [wip, setWip] = useState<JobWip | null>(null);
  const [refCurrency, setRefCurrency] = useState("USD");
  const [payAmount, setPayAmount] = useState("");
  const [payCurrency, setPayCurrency] = useState("ARS");
  const [payFx, setPayFx] = useState("1");
  const [payNote, setPayNote] = useState("");
  const [invAmount, setInvAmount] = useState("");
  const [invCurrency, setInvCurrency] = useState("ARS");
  const [invFx, setInvFx] = useState("1");
  const [invNote, setInvNote] = useState("");
  const [expenseCurrency, setExpenseCurrency] = useState("ARS");
  const [expenseFx, setExpenseFx] = useState("1");

  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [invoicePhotoUrl, setInvoicePhotoUrl] = useState<string | null>(null);
  const [readingInvoice, setReadingInvoice] = useState(false);
  const [invoiceReadError, setInvoiceReadError] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("");
  const [noteText, setNoteText] = useState("");

  const [statusError, setStatusError] = useState("");
  const [expenseError, setExpenseError] = useState("");
  const [invoiceError, setInvoiceError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [machineError, setMachineError] = useState("");
  const [workerError, setWorkerError] = useState("");
  const [noteError, setNoteError] = useState("");

  async function loadAll() {
    const [jobRes, expRes, assignedRes, machRes, logRes, workersRes, payRes, invRes, ordersRes, wipRes, settingsRes, compRes] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", id).single(),
      supabase.from("job_expenses").select("*").eq("job_id", id).order("created_at", { ascending: false }),
      supabase.from("job_machines").select("*, machine:machines(*)").eq("job_id", id).is("returned_at", null),
      supabase.from("machines").select("*").eq("status", "disponible"),
      supabase.from("job_log").select("*").eq("job_id", id).order("created_at", { ascending: false }),
      supabase.from("job_workers").select("*").eq("job_id", id).order("created_at", { ascending: true }),
      supabase.from("job_payments").select("*").eq("job_id", id).order("paid_at", { ascending: false }),
      supabase.from("job_invoices").select("*").eq("job_id", id).order("invoiced_at", { ascending: false }),
      supabase.from("work_orders").select("*, machine:machines(*)").eq("job_id", id).order("created_at", { ascending: false }),
      supabase.from("job_wip").select("*").eq("job_id", id).maybeSingle(),
      supabase.from("settings").select("*").eq("key", "reference_currency").single(),
      supabase.from("companies").select("id").maybeSingle(),
    ]);
    setJob(jobRes.data);
    setExpenses(expRes.data ?? []);
    setAssigned((assignedRes.data as JobMachine[]) ?? []);
    setAvailableMachines(machRes.data ?? []);
    setLog(logRes.data ?? []);
    setWorkers(workersRes.data ?? []);
    setPayments(payRes.data ?? []);
    setInvoices(invRes.data ?? []);
    setRelatedOrders((ordersRes.data as WorkOrder[]) ?? []);
    setWip((wipRes.data as JobWip) ?? null);
    if (settingsRes.data) setRefCurrency(settingsRes.data.value);
    if (compRes.data) setCompanyId(compRes.data.id);
    setLoading(false);
  }

  useEffect(() => {
    if (id) loadAll();
  }, [id]);

  async function changeStatus(status: JobStatus) {
    setStatusError("");
    const ok = await runMutation(() => supabase.from("jobs").update({ status }).eq("id", id), setStatusError);
    if (!ok) return;
    await logAudit("job", id, "cambio de estado", `"${job?.name}" pasó a "${status}"`);
    loadAll();
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!expenseDesc.trim() || !expenseAmount) return;
    const ok = await runMutation(
      () =>
        supabase.from("job_expenses").insert({
          job_id: id,
          description: expenseDesc,
          amount: Number(expenseAmount),
          currency: expenseCurrency,
          fx_rate: expenseFx ? Number(expenseFx) : 1,
          invoice_photo_url: invoicePhotoUrl,
        }),
      setExpenseError
    );
    if (!ok) return;
    await logAudit("job_expense", id, "gasto cargado", `${expenseDesc}: ${expenseAmount} ${expenseCurrency}`);
    setExpenseDesc("");
    setExpenseAmount("");
    setInvoicePhotoUrl(null);
    loadAll();
  }

  async function verFactura(path: string) {
    const { data, error } = await supabase.storage.from("facturas").createSignedUrl(path, 60);
    if (error || !data) {
      setExpenseError("No se pudo abrir la factura.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleInvoicePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!companyId) {
      setInvoiceReadError("Todavía está cargando la página, esperá un segundo y probá de nuevo.");
      return;
    }
    setInvoiceReadError("");
    setReadingInvoice(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${companyId}/${id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("facturas").upload(path, file);
      if (!uploadError) setInvoicePhotoUrl(path);

      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("leer-factura", {
        body: { image_base64: base64, media_type: file.type || "image/jpeg" },
      });
      if (error || !data || data.error) {
        setInvoiceReadError("No se pudo leer la factura automáticamente. Completá el gasto a mano.");
      } else {
        if (data.description) setExpenseDesc(data.description);
        if (data.amount != null) setExpenseAmount(String(data.amount));
        if (data.currency) setExpenseCurrency(data.currency);
      }
    } catch {
      setInvoiceReadError("No se pudo leer la factura automáticamente. Completá el gasto a mano.");
    } finally {
      setReadingInvoice(false);
    }
  }

  async function addPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payAmount) return;
    const ok = await runMutation(
      () =>
        supabase.from("job_payments").insert({
          job_id: id,
          amount: Number(payAmount),
          currency: payCurrency,
          fx_rate: payFx ? Number(payFx) : 1,
          note: payNote,
        }),
      setPaymentError
    );
    if (!ok) return;
    await logAudit("job_payment", id, "pago registrado", `${payAmount} ${payCurrency}${payNote ? ` — ${payNote}` : ""}`);
    setPayAmount("");
    setPayNote("");
    loadAll();
  }

  async function addInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!invAmount) return;
    const ok = await runMutation(
      () =>
        supabase.from("job_invoices").insert({
          job_id: id,
          amount: Number(invAmount),
          currency: invCurrency,
          fx_rate: invFx ? Number(invFx) : 1,
          note: invNote,
        }),
      setInvoiceError
    );
    if (!ok) return;
    await logAudit("job_invoice", id, "factura registrada", `${invAmount} ${invCurrency}${invNote ? ` — ${invNote}` : ""}`);
    setInvAmount("");
    setInvNote("");
    loadAll();
  }

  async function assignMachine(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMachine) return;
    setMachineError("");
    const machineName = availableMachines.find((m) => m.id === selectedMachine)?.name ?? "";
    const ok1 = await runMutation(() => supabase.from("job_machines").insert({ job_id: id, machine_id: selectedMachine }), setMachineError);
    if (!ok1) return;
    const ok2 = await runMutation(() => supabase.from("machines").update({ status: "en_obra" }).eq("id", selectedMachine), setMachineError);
    if (!ok2) return;
    await logAudit("machine", selectedMachine, "asignado a obra", `"${machineName}" asignado a "${job?.name}"`);
    setSelectedMachine("");
    loadAll();
  }

  async function returnMachine(jobMachineId: string, machineId: string, machineName: string) {
    setMachineError("");
    const ok1 = await runMutation(
      () => supabase.from("job_machines").update({ returned_at: new Date().toISOString() }).eq("id", jobMachineId),
      setMachineError
    );
    if (!ok1) return;
    const ok2 = await runMutation(() => supabase.from("machines").update({ status: "disponible" }).eq("id", machineId), setMachineError);
    if (!ok2) return;
    await logAudit("machine", machineId, "devuelto de obra", `"${machineName}" devuelto de "${job?.name}"`);
    loadAll();
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    const ok = await runMutation(() => supabase.from("job_log").insert({ job_id: id, note: noteText }), setNoteError);
    if (!ok) return;
    setNoteText("");
    loadAll();
  }

  async function addWorker(e: React.FormEvent) {
    e.preventDefault();
    if (!pickedContact) return;
    const ok = await runMutation(
      () =>
        supabase.from("job_workers").insert({
          job_id: id,
          contact_id: pickedContact.id,
          name: pickedContact.name,
          role: wRole || pickedContact.role,
          phone: pickedContact.phone,
          email: pickedContact.email,
        }),
      setWorkerError
    );
    if (!ok) return;
    await logAudit("job_worker", id, "colaborador agregado", `${pickedContact.name} se sumó a "${job?.name}"`);
    setPickedContact(null);
    setWRole("");
    setShowWorkerForm(false);
    loadAll();
  }

  async function removeWorker(workerId: string, workerName: string) {
    setWorkerError("");
    const ok = await runMutation(() => supabase.from("job_workers").delete().eq("id", workerId), setWorkerError);
    if (!ok) return;
    await logAudit("job_worker", id, "colaborador quitado", `${workerName} salió de "${job?.name}"`);
    loadAll();
  }

  if (loading) return <p className="text-steel text-sm">Cargando...</p>;
  if (!job) return <p className="text-steel text-sm">No se encontró la obra.</p>;

  const budgetRef = toReference(Number(job.budget), Number(job.budget_fx_rate));
  const spentRef = expenses.reduce((sum, e) => sum + toReference(Number(e.amount), Number(e.fx_rate)), 0);
  const paidRef = payments.reduce((sum, p) => sum + toReference(Number(p.amount), Number(p.fx_rate)), 0);
  const invoicedRef = invoices.reduce((sum, inv) => sum + toReference(Number(inv.amount), Number(inv.fx_rate)), 0);
  const pendingRef = budgetRef - paidRef;
  const pctCost = budgetRef > 0 ? Math.min(100, Math.round((spentRef / budgetRef) * 100)) : 0;
  const pctPaid = budgetRef > 0 ? Math.min(100, Math.round((paidRef / budgetRef) * 100)) : 0;

  return (
    <div className="max-w-4xl">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-steel uppercase tracking-wide">{job.client || "Obra"}</p>
          <h1 className="font-display font-bold text-3xl text-ink">{job.name}</h1>
        </div>
        {canWrite(role) ? (
          <select
            className="focus-ring text-xs border border-line rounded-tag px-3 py-1.5 bg-white h-fit"
            value={job.status}
            onChange={(e) => changeStatus(e.target.value as JobStatus)}
          >
            <option value="planificada">Planificada</option>
            <option value="en_curso">En curso</option>
            <option value="terminada">Terminada</option>
          </select>
        ) : (
          <StatusBadge status={job.status} />
        )}
      </header>
      <FormError message={statusError} />

      {/* Ficha destacada */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <InfoBlock label="Plazo">
          <p className="text-sm text-ink font-mono">
            {job.start_date ?? "sin inicio"} → {job.end_date ?? "sin plazo"}
          </p>
        </InfoBlock>
        <InfoBlock label="Ubicación">
          <p className="text-sm text-ink">{job.location || "—"}</p>
        </InfoBlock>
        <InfoBlock label="Responsable interno">
          <p className="text-sm text-ink">{job.responsible_name || "—"}</p>
        </InfoBlock>
        <div className="col-span-1 sm:col-span-3 pt-4 border-t border-line">
          <InfoBlock label="Contacto del cliente">
            {job.contact_id ? (
              <Link href={`/contactos?open=${job.contact_id}`} className="text-sm text-accent hover:underline">
                {job.contact_name || "ver ficha"}
              </Link>
            ) : (
              <p className="text-sm text-ink">{job.contact_name || "—"}</p>
            )}
            <p className="text-xs text-steel mt-0.5">
              {job.contact_phone && <span className="serial">{job.contact_phone}</span>}
              {job.contact_phone && job.contact_email && <span> · </span>}
              {job.contact_email && <span>{job.contact_email}</span>}
            </p>
          </InfoBlock>
        </div>
      </section>

      {/* WIP — avance de obra en términos financieros */}
      {wip && (
        <section className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6">
          <h2 className="font-display font-bold text-sm mb-1">WIP (avance devengado)</h2>
          <p className="text-[11px] text-steel font-mono mb-4">
            Método costo-a-costo: % avance = costo incurrido / presupuesto. Convertido a {refCurrency}.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <WipStat label="% avance" value={`${Math.round(wip.pct_complete * 100)}%`} />
            <WipStat label="Devengado" value={formatMoney(wip.earned_revenue, refCurrency)} />
            <WipStat label="Facturado" value={formatMoney(invoicedRef, refCurrency)} />
            <WipStat
              label={wip.over_under_billing >= 0 ? "Sobre-facturado" : "Sub-facturado"}
              value={formatMoney(Math.abs(wip.over_under_billing), refCurrency)}
              tone={wip.over_under_billing >= 0 ? "info" : "warn"}
            />
          </div>
          <div className="mt-3 pt-3 border-t border-line">
            <p className={`text-sm font-medium ${wip.estimated_result >= 0 ? "text-ok" : "text-warn"}`}>
              Resultado estimado: {wip.estimated_result >= 0 ? "ganancia" : "pérdida"} de {formatMoney(Math.abs(wip.estimated_result), refCurrency)}
            </p>
          </div>
        </section>
      )}

      {/* Presupuesto y moneda */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-bold text-sm">Presupuesto</h2>
          <span className="serial">
            {formatMoney(Number(job.budget), job.budget_currency)}
            {job.budget_currency !== refCurrency && <> · ≈ {formatMoney(budgetRef, refCurrency)}</>}
          </span>
        </div>
        <p className="text-[11px] text-steel font-mono mb-3">Todo lo demás en esta ficha se muestra convertido a {refCurrency}, tu moneda de referencia (configurable en Ajustes).</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="flex justify-between text-xs text-steel mb-1">
              <span>Cobrado</span>
              <span className="serial">{formatMoney(paidRef, refCurrency)} / {formatMoney(budgetRef, refCurrency)}</span>
            </div>
            <div className="h-2 bg-line rounded-full overflow-hidden">
              <div className={`h-full ${pctPaid >= 100 ? "bg-ok" : "bg-info"}`} style={{ width: `${pctPaid}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-steel mb-1">
              <span>Costo incurrido</span>
              <span className="serial">{formatMoney(spentRef, refCurrency)} / {formatMoney(budgetRef, refCurrency)}</span>
            </div>
            <div className="h-2 bg-line rounded-full overflow-hidden">
              <div className={`h-full ${pctCost >= 100 ? "bg-warn" : "bg-accent"}`} style={{ width: `${pctCost}%` }} />
            </div>
          </div>
        </div>

        <p className={`text-xs mb-4 ${pendingRef > 0 ? "text-warn" : "text-ok"}`}>
          {pendingRef > 0
            ? `Saldo pendiente de cobro: ${formatMoney(pendingRef, refCurrency)}`
            : pendingRef < 0
            ? `Se cobró de más: ${formatMoney(Math.abs(pendingRef), refCurrency)}`
            : "Cobrado por completo."}
        </p>

        <p className="text-xs text-steel uppercase tracking-wide font-mono mb-2">Gastos reales</p>
        {canWrite(role) && (
          <>
            <label className="focus-ring inline-flex items-center gap-1.5 text-xs text-accent font-mono hover:underline mb-2 cursor-pointer">
              📷 {readingInvoice ? "Leyendo factura..." : "Leer factura con IA"}
              <input type="file" accept="image/*" className="hidden" onChange={handleInvoicePhoto} disabled={readingInvoice} />
            </label>
            {invoicePhotoUrl && <p className="text-[11px] text-ok mb-2">Foto adjunta — revisá los datos y confirmá abajo.</p>}
            {invoiceReadError && <p className="text-[11px] text-warn mb-2">{invoiceReadError}</p>}
            <form onSubmit={addExpense} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input
                className="focus-ring col-span-2 border border-line rounded-tag px-3 py-1.5 text-sm"
                placeholder="Descripción del gasto"
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
              />
              <input
                className="focus-ring border border-line rounded-tag px-3 py-1.5 text-sm"
                placeholder="Monto"
                type="number"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
              />
              <select className="focus-ring border border-line rounded-tag px-2 py-1.5 text-sm bg-white" value={expenseCurrency} onChange={(e) => setExpenseCurrency(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <FxRateField
                className="col-span-2 sm:col-span-3"
                amount={expenseAmount}
                currency={expenseCurrency}
                refCurrency={refCurrency}
                fxRate={expenseFx}
                onFxRateChange={setExpenseFx}
              />
              <button className="focus-ring bg-ink text-white text-sm px-4 py-1.5 rounded-tag h-fit">Agregar</button>
            </form>
            <FormError message={expenseError} />
          </>
        )}
        {expenses.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-steel">
            {expenses.map((e) => (
              <li key={e.id} className="flex justify-between items-center">
                <span>
                  {e.description}
                  {e.invoice_photo_url && (
                    <button
                      onClick={() => verFactura(e.invoice_photo_url!)}
                      className="focus-ring ml-1.5 text-accent hover:underline"
                    >
                      📎 ver factura
                    </button>
                  )}
                </span>
                <span className="serial">{formatMoney(Number(e.amount), e.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Facturación */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6">
        <h2 className="font-display font-bold text-sm mb-3">Facturado al cliente</h2>
        <p className="text-[11px] text-steel font-mono mb-3">Distinto de "cobrado": esto es lo que ya se facturó, cobrado o no.</p>
        {canWrite(role) && (
          <>
            <form onSubmit={addInvoice} className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <input
                className="focus-ring border border-line rounded-tag px-3 py-1.5 text-sm"
                placeholder="Monto"
                type="number"
                value={invAmount}
                onChange={(e) => setInvAmount(e.target.value)}
              />
              <select className="focus-ring border border-line rounded-tag px-2 py-1.5 text-sm bg-white" value={invCurrency} onChange={(e) => setInvCurrency(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <FxRateField amount={invAmount} currency={invCurrency} refCurrency={refCurrency} fxRate={invFx} onFxRateChange={setInvFx} />
              <input
                className="focus-ring border border-line rounded-tag px-3 py-1.5 text-sm h-fit"
                placeholder="Nota (opcional)"
                value={invNote}
                onChange={(e) => setInvNote(e.target.value)}
              />
              <button className="focus-ring col-span-2 sm:col-span-4 bg-ink text-white text-sm py-1.5 rounded-tag">Registrar factura</button>
            </form>
            <FormError message={invoiceError} />
          </>
        )}
        <div className="space-y-1">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex justify-between text-xs text-steel border-b border-line pb-1">
              <span>{inv.invoiced_at} {inv.note && `· ${inv.note}`}</span>
              <span className="serial">{formatMoney(Number(inv.amount), inv.currency)}</span>
            </div>
          ))}
          {invoices.length === 0 && <p className="text-sm text-steel">Sin facturas registradas todavía.</p>}
        </div>
      </section>

      {/* Pagos recibidos */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6">
        <h2 className="font-display font-bold text-sm mb-3">Pagos recibidos del cliente</h2>
        {canWrite(role) && (
          <>
            <form onSubmit={addPayment} className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <input
                className="focus-ring border border-line rounded-tag px-3 py-1.5 text-sm"
                placeholder="Monto"
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
              <select className="focus-ring border border-line rounded-tag px-2 py-1.5 text-sm bg-white" value={payCurrency} onChange={(e) => setPayCurrency(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <FxRateField amount={payAmount} currency={payCurrency} refCurrency={refCurrency} fxRate={payFx} onFxRateChange={setPayFx} />
              <input
                className="focus-ring border border-line rounded-tag px-3 py-1.5 text-sm h-fit"
                placeholder="Nota (opcional)"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
              />
              <button className="focus-ring col-span-2 sm:col-span-4 bg-ink text-white text-sm py-1.5 rounded-tag">Registrar pago</button>
            </form>
            <FormError message={paymentError} />
          </>
        )}
        <div className="space-y-1">
          {payments.map((p) => (
            <div key={p.id} className="flex justify-between text-xs text-steel border-b border-line pb-1">
              <span>{p.paid_at} {p.note && `· ${p.note}`}</span>
              <span className="serial">
                {formatMoney(Number(p.amount), p.currency)}
                {p.currency !== refCurrency && <> (≈ {formatMoney(toReference(Number(p.amount), Number(p.fx_rate)), refCurrency)})</>}
              </span>
            </div>
          ))}
          {payments.length === 0 && <p className="text-sm text-steel">Sin pagos registrados todavía.</p>}
        </div>
      </section>

      {/* Maquinaria asignada */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6">
        <h2 className="font-display font-bold text-sm mb-3">Maquinaria en esta obra</h2>
        {canWrite(role) && (
          <>
            <form onSubmit={assignMachine} className="flex gap-2 mb-4">
              <select
                className="focus-ring flex-1 border border-line rounded-tag px-3 py-1.5 text-sm bg-white"
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
              >
                <option value="">Elegir máquina disponible...</option>
                {availableMachines.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <button className="focus-ring bg-ink text-white text-sm px-4 py-1.5 rounded-tag">Asignar</button>
            </form>
            <FormError message={machineError} />
          </>
        )}
        <div className="space-y-2">
          {assigned.map((am) => (
            <div key={am.id} className="asset-tag status-en_obra px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{am.machine?.name}</p>
                <p className="serial">{am.machine?.serial}</p>
              </div>
              {canWrite(role) && (
                <button
                  onClick={() => returnMachine(am.id, am.machine_id, am.machine?.name ?? "")}
                  className="focus-ring text-xs text-accent font-mono hover:underline"
                >
                  devolver al inventario
                </button>
              )}
            </div>
          ))}
          {assigned.length === 0 && <p className="text-sm text-steel">Ninguna máquina asignada todavía.</p>}
        </div>
      </section>

      {/* Colaboradores */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-sm">Colaboradores en esta obra</h2>
          {canWrite(role) && (
            <button
              onClick={() => setShowWorkerForm((s) => !s)}
              className="focus-ring text-xs text-accent font-mono hover:underline"
            >
              {showWorkerForm ? "cancelar" : "+ agregar"}
            </button>
          )}
        </div>

        {showWorkerForm && canWrite(role) && (
          <form onSubmit={addWorker} className="mb-4 bg-base rounded-tag p-3 space-y-2">
            {pickedContact ? (
              <div className="flex items-center justify-between border border-line rounded-tag px-3 py-2 bg-white">
                <div>
                  <p className="text-sm text-ink">{pickedContact.name}</p>
                  <p className="text-xs text-steel">{pickedContact.phone} {pickedContact.email && `· ${pickedContact.email}`}</p>
                </div>
                <button type="button" onClick={() => setPickedContact(null)} className="focus-ring text-xs text-accent font-mono">
                  cambiar
                </button>
              </div>
            ) : (
              <ContactPicker onSelect={setPickedContact} placeholder="Buscar contacto o escribir uno nuevo..." />
            )}
            <input
              className="focus-ring w-full border border-line rounded-tag px-3 py-1.5 text-sm"
              placeholder="Rol en esta obra (opcional, ej: capataz)"
              value={wRole}
              onChange={(e) => setWRole(e.target.value)}
            />
            <button disabled={!pickedContact} className="focus-ring w-full bg-ink text-white text-sm py-1.5 rounded-tag disabled:opacity-40">
              Agregar a la obra
            </button>
          </form>
        )}
        <FormError message={workerError} />

        <div className="space-y-2">
          {workers.map((w) => (
            <div key={w.id} className="border border-line rounded-tag overflow-hidden">
              <button
                onClick={() => setOpenWorker(openWorker === w.id ? null : w.id)}
                className="focus-ring w-full flex items-center justify-between px-4 py-3 text-left hover:bg-base transition-colors"
              >
                <span className="text-sm font-medium text-ink">{w.name}</span>
                <span className="text-xs text-steel">{w.role || "sin rol"}</span>
              </button>
              {openWorker === w.id && (
                <div className="px-4 py-3 border-t border-line bg-base text-xs text-steel space-y-1">
                  <p>Teléfono: <span className="serial">{w.phone || "—"}</span></p>
                  <p>Email: {w.email || "—"}</p>
                  {w.notes && <p>Notas: {w.notes}</p>}
                  {canWrite(role) && (
                    <button onClick={() => removeWorker(w.id, w.name)} className="focus-ring text-accent font-mono mt-2 hover:underline">
                      quitar de la obra
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {workers.length === 0 && <p className="text-sm text-steel">Sin colaboradores asignados todavía.</p>}
        </div>
      </section>

      {/* Órdenes de trabajo vinculadas */}
      {relatedOrders.length > 0 && (
        <section className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-sm">Órdenes de trabajo de esta obra</h2>
            <Link href="/ordenes" className="text-xs text-accent font-mono hover:underline">ver todas →</Link>
          </div>
          <div className="space-y-2">
            {relatedOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-sm border-b border-line pb-2">
                <div>
                  <span className="font-medium text-ink">{o.title}</span>
                  <span className="text-xs text-steel ml-2">{o.machine?.name}</span>
                </div>
                <StatusBadge status={o.status} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bitácora */}
      <section className="bg-panel border border-line rounded-tag shadow-card p-5">
        <h2 className="font-display font-bold text-sm mb-3">Bitácora de avance</h2>
        {canWrite(role) && (
          <>
            <form onSubmit={addNote} className="flex gap-2 mb-4">
              <input
                className="focus-ring flex-1 border border-line rounded-tag px-3 py-1.5 text-sm"
                placeholder="Anotar avance de hoy..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <button className="focus-ring bg-ink text-white text-sm px-4 py-1.5 rounded-tag">Anotar</button>
            </form>
            <FormError message={noteError} />
          </>
        )}
        <ul className="space-y-3">
          {log.map((entry) => (
            <li key={entry.id} className="text-sm border-l-2 border-line pl-3">
              <p className="text-ink">{entry.note}</p>
              <p className="text-[11px] text-steel font-mono mt-0.5">
                {new Date(entry.created_at).toLocaleString("es-AR")}
              </p>
            </li>
          ))}
          {log.length === 0 && <p className="text-sm text-steel">Sin anotaciones todavía.</p>}
        </ul>
      </section>
    </div>
  );
}

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-steel uppercase tracking-wide font-mono mb-1">{label}</p>
      {children}
    </div>
  );
}

function WipStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-base rounded-tag px-3 py-2">
      <p className={`font-display font-bold text-sm ${tone ? `text-${tone}` : "text-ink"}`}>{value}</p>
      <p className="text-[11px] text-steel mt-0.5">{label}</p>
    </div>
  );
}

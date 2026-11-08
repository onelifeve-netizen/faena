"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Location } from "@/lib/types";
import { parseExcelFile, ParsedRow } from "@/lib/excelImport";
type ColumnMapEntry = { header: string; field: string };
import { logAudit } from "@/lib/audit";
import FormError from "@/components/FormError";

export default function ExcelImport({ zones, onDone, onClose }: { zones: Location[]; onDone: () => void; onClose: () => void }) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMapEntry[]>([]);
  const [unmatchedHeaders, setUnmatchedHeaders] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<number | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setDone(null);
    setParsing(true);
    try {
      const parsed = await parseExcelFile(file);
      setRows(parsed.rows);
      setColumnMap(parsed.columnMap);
      setUnmatchedHeaders(parsed.unmatchedHeaders);
    } catch {
      setError("No se pudo leer el archivo. Confirmá que sea un .xlsx, .xls o .csv válido.");
    } finally {
      setParsing(false);
    }
  }

  async function confirmImport() {
    const valid = rows.filter((r) => !r.error);
    if (valid.length === 0) return;
    setImporting(true);
    setError("");
    try {
      // Resolver/crear zonas para los nombres de ubicación nuevos.
      const zoneByName = new Map(zones.map((z) => [z.name.trim().toLowerCase(), z.id]));
      const neededNames = Array.from(
        new Set(valid.map((r) => r.location_name?.trim()).filter((n): n is string => !!n && !zoneByName.has(n.toLowerCase())))
      );
      for (const name of neededNames) {
        const { data } = await supabase.from("locations").insert({ name }).select().single();
        if (data) zoneByName.set(name.toLowerCase(), data.id);
      }

      const toInsert = valid.flatMap((r) =>
        Array.from({ length: r.quantity }, () => ({
          name: r.name,
          item_type: r.item_type?.toLowerCase() || "equipo",
          serial: r.serial,
          category: r.category,
          notes: r.notes,
          purchase_date: r.purchase_date,
          purchase_price: r.unit_price,
          purchase_price_currency: "ARS",
          purchase_price_fx_rate: 1,
          status: "disponible",
          location_id: r.location_name ? zoneByName.get(r.location_name.trim().toLowerCase()) ?? null : null,
        }))
      );

      const { error: insertError } = await supabase.from("machines").insert(toInsert);
      if (insertError) {
        setError("No se pudo completar la importación. Revisá que los datos sean válidos.");
        return;
      }
      await logAudit("machine", null, "importación desde Excel", `${toInsert.length} artículo(s) agregados`);
      setDone(toInsert.length);
      setRows([]);
      setColumnMap([]);
      setUnmatchedHeaders([]);
      onDone();
    } finally {
      setImporting(false);
    }
  }

  const validCount = rows.filter((r) => !r.error).length;
  const errorCount = rows.length - validCount;

  return (
    <div className="bg-panel border border-line rounded-tag shadow-card p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-steel uppercase tracking-wide font-mono">Importar desde Excel</p>
        <button onClick={onClose} className="focus-ring text-xs text-steel font-mono">
          cerrar
        </button>
      </div>
      <p className="text-xs text-steel mb-3">
        Columnas reconocidas (no hace falta tenerlas todas): descripción, tipo, serial, cantidad, costo
        unidad (o costo total), ubicación, observación, fecha. Las ubicaciones que no existan se crean
        solas como zonas nuevas.
      </p>

      {done !== null ? (
        <p className="text-sm text-ok">✓ Se importaron {done} artículo(s).</p>
      ) : (
        <>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            className="focus-ring text-xs"
            disabled={parsing || importing}
          />
          <FormError message={error} />

          {parsing && <p className="text-xs text-steel mt-2">Leyendo archivo...</p>}

          {columnMap.length > 0 && (
            <div className="mt-3 bg-base rounded-tag p-2.5">
              <p className="text-[10px] text-steel uppercase tracking-wide font-mono mb-1.5">Columnas detectadas</p>
              <div className="flex flex-wrap gap-1.5">
                {columnMap.map((c) => (
                  <span key={c.header} className="text-[11px] bg-white border border-line rounded-tag px-2 py-0.5">
                    "{c.header}" → <span className="text-accent">{c.field}</span>
                  </span>
                ))}
              </div>
              {unmatchedHeaders.length > 0 && (
                <p className="text-[11px] text-steel mt-1.5">
                  Sin usar: {unmatchedHeaders.map((h) => `"${h}"`).join(", ")}
                </p>
              )}
            </div>
          )}

          {rows.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-steel mb-2">
                {validCount} fila(s) lista(s) para importar
                {errorCount > 0 && <span className="text-warn"> · {errorCount} con error (se omiten)</span>}
              </p>
              <div className="max-h-56 overflow-y-auto border border-line rounded-tag">
                <table className="w-full text-xs">
                  <thead className="bg-base sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1">Fila</th>
                      <th className="text-left px-2 py-1">Nombre</th>
                      <th className="text-left px-2 py-1">Tipo</th>
                      <th className="text-left px-2 py-1">Cant.</th>
                      <th className="text-left px-2 py-1">Ubicación</th>
                      <th className="text-left px-2 py-1">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r) => (
                      <tr key={r.rowNumber} className="border-t border-line">
                        <td className="px-2 py-1 text-steel">{r.rowNumber}</td>
                        <td className="px-2 py-1">{r.name || "—"}</td>
                        <td className="px-2 py-1">{r.item_type || "—"}</td>
                        <td className="px-2 py-1">{r.quantity}</td>
                        <td className="px-2 py-1">{r.location_name || "—"}</td>
                        <td className="px-2 py-1">
                          {r.error ? <span className="text-warn">{r.error}</span> : <span className="text-ok">ok</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={confirmImport}
                disabled={importing || validCount === 0}
                className="focus-ring mt-3 bg-ink text-white text-sm px-4 py-1.5 rounded-tag disabled:opacity-40"
              >
                {importing ? "Importando..." : `Confirmar importación (${validCount})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

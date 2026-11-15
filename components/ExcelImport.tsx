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
  const [fileName, setFileName] = useState("");
  const [headerRowSkipped, setHeaderRowSkipped] = useState(0);
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
    setFileName(file.name);
    setParsing(true);
    try {
      const parsed = await parseExcelFile(file);
      setRows(parsed.rows);
      setColumnMap(parsed.columnMap);
      setUnmatchedHeaders(parsed.unmatchedHeaders);
      setHeaderRowSkipped(parsed.headerRowSkipped);
    } catch {
      setError("No se pudo leer ese archivo. Fijate que sea un Excel (.xlsx) o una planilla de cálculo válida.");
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
      const zoneHasCoords = new Set(zones.filter((z) => z.coordinates).map((z) => z.name.trim().toLowerCase()));
      // Coordenadas GPS de la zona (si la planilla las trae) — la primera que aparezca para cada nombre de zona.
      const coordsByZoneName = new Map<string, string>();
      for (const r of valid) {
        const zoneName = r.location_name?.trim().toLowerCase();
        if (zoneName && r.coordinates && !coordsByZoneName.has(zoneName)) coordsByZoneName.set(zoneName, r.coordinates);
      }

      const neededNames = Array.from(
        new Set(valid.map((r) => r.location_name?.trim()).filter((n): n is string => !!n && !zoneByName.has(n.toLowerCase())))
      );
      for (const name of neededNames) {
        const { data } = await supabase
          .from("locations")
          .insert({ name, coordinates: coordsByZoneName.get(name.toLowerCase()) ?? null })
          .select()
          .single();
        if (data) zoneByName.set(name.toLowerCase(), data.id);
      }

      // Zonas que ya existían pero todavía no tenían coordenadas cargadas.
      for (const [zoneNameLower, coords] of coordsByZoneName) {
        if (zoneHasCoords.has(zoneNameLower)) continue;
        const zoneId = zoneByName.get(zoneNameLower);
        if (zoneId) await supabase.from("locations").update({ coordinates: coords }).eq("id", zoneId);
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
      setFileName("");
      onDone();
    } finally {
      setImporting(false);
    }
  }

  const validCount = rows.filter((r) => !r.error).length;
  const errorCount = rows.length - validCount;

  return (
    <div className="bg-panel border border-line rounded-tag shadow-card p-5 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display font-bold text-base text-ink">Importar inventario desde Excel</h2>
        <button onClick={onClose} className="focus-ring text-sm text-steel hover:text-ink font-mono">
          ✕ cerrar
        </button>
      </div>

      {done !== null ? (
        <div className="bg-ok/10 border border-ok/20 rounded-tag px-4 py-4 mt-3">
          <p className="text-base font-medium text-ok">✓ ¡Listo! Se cargaron {done} artículo(s) al inventario.</p>
          <button onClick={onClose} className="focus-ring text-sm text-accent font-mono hover:underline mt-2">
            cerrar
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-steel mt-1 mb-4">
            No hace falta acomodar tu planilla. El sistema intenta reconocer sola las columnas aunque no se llamen
            exactamente igual (ej: "Costo $/ Unidad" también funciona).
          </p>

          {/* Paso 1 */}
          <p className="text-sm font-semibold text-ink mb-2">Paso 1 — Elegí el archivo</p>
          <label
            className={`focus-ring flex items-center justify-center gap-2 border-2 border-dashed rounded-tag py-4 cursor-pointer transition-colors ${
              parsing ? "border-line bg-base" : "border-accent/40 hover:border-accent hover:bg-accent/5"
            }`}
          >
            <span className="text-sm font-medium text-accent">
              {parsing ? "Leyendo el archivo..." : fileName ? `📄 ${fileName} — elegir otro archivo` : "📂 Tocá acá para elegir tu planilla (.xlsx, .xls o .csv)"}
            </span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" disabled={parsing || importing} />
          </label>
          <FormError message={error} />

          {columnMap.length > 0 && (
            <>
              {/* Paso 2 */}
              <p className="text-sm font-semibold text-ink mt-5 mb-2">Paso 2 — Revisá cómo se entendió tu planilla</p>
              {headerRowSkipped > 0 && (
                <p className="text-xs text-steel mb-2">
                  ℹ️ Encontramos los títulos de columna en la fila {headerRowSkipped + 1} de tu archivo — se ignoraron las
                  filas de arriba (título, filas vacías, etc.).
                </p>
              )}
              <div className="bg-base rounded-tag p-3">
                <p className="text-xs text-steel mb-2">Estas columnas de tu archivo se reconocieron así:</p>
                <div className="flex flex-wrap gap-2">
                  {columnMap.map((c) => (
                    <span key={c.header} className="text-sm bg-white border border-line rounded-tag px-2.5 py-1">
                      "{c.header}" → <span className="text-accent font-medium">{c.field}</span>
                    </span>
                  ))}
                </div>
                {unmatchedHeaders.length > 0 && (
                  <p className="text-xs text-steel mt-3">
                    No se usaron estas columnas de tu archivo, no hay problema, simplemente se ignoran:{" "}
                    {unmatchedHeaders.map((h) => `"${h}"`).join(", ")}.
                  </p>
                )}
              </div>
            </>
          )}

          {rows.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-ink mb-2">Paso 3 — Confirmá la importación</p>
              <p className="text-sm text-steel mb-2">
                <span className="text-ok font-medium">{validCount} artículo(s) listos</span> para cargar
                {errorCount > 0 && <span className="text-warn"> · {errorCount} fila(s) con problema, no se van a cargar</span>}
              </p>
              <div className="max-h-64 overflow-y-auto overflow-x-auto border border-line rounded-tag">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-base sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2">Fila</th>
                      <th className="text-left px-3 py-2">Nombre</th>
                      <th className="text-left px-3 py-2">Tipo</th>
                      <th className="text-left px-3 py-2">Cant.</th>
                      <th className="text-right px-3 py-2">Costo unidad</th>
                      <th className="text-right px-3 py-2">Costo total</th>
                      <th className="text-left px-3 py-2">Ubicación</th>
                      <th className="text-left px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.rowNumber} className="border-t border-line">
                        <td className="px-3 py-2 text-steel">{r.rowNumber}</td>
                        <td className="px-3 py-2">{r.name || "—"}</td>
                        <td className="px-3 py-2">{r.item_type || "—"}</td>
                        <td className="px-3 py-2">{r.quantity}</td>
                        <td className="px-3 py-2 text-right">{r.unit_price != null ? r.unit_price.toLocaleString("es-AR") : "—"}</td>
                        <td className="px-3 py-2 text-right">{r.unit_price != null ? (r.unit_price * r.quantity).toLocaleString("es-AR") : "—"}</td>
                        <td className="px-3 py-2">{r.location_name || "—"}</td>
                        <td className="px-3 py-2">
                          {r.error ? <span className="text-warn">⚠ {r.error}</span> : <span className="text-ok">✓ ok</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={confirmImport}
                disabled={importing || validCount === 0}
                className="focus-ring mt-4 w-full sm:w-auto bg-ink text-white text-base font-medium px-6 py-3 rounded-tag disabled:opacity-40 hover:bg-ink/90"
              >
                {importing ? "Importando, un momento..." : `✓ Confirmar e importar ${validCount} artículo(s)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

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
  const [fileCurrency, setFileCurrency] = useState("USD");
  const [done, setDone] = useState<{
    created: number;
    updated: number;
    notFound: number;
    ignored: number;
    totalValue: number;
    zoneWarnings: string[];
  } | null>(null);

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
      const zoneWarnings: string[] = [];
      if (neededNames.length > 0) {
        const { data: createdZones, error: zoneErr } = await supabase
          .from("locations")
          .upsert(
            neededNames.map((name) => ({ name, coordinates: coordsByZoneName.get(name.toLowerCase()) ?? null })),
            { onConflict: "company_id,name" }
          )
          .select();
        if (zoneErr) {
          zoneWarnings.push(`No se pudieron crear las zonas (${neededNames.join(", ")}): ${zoneErr.message}`);
        } else {
          for (const z of createdZones ?? []) {
            zoneByName.set((z as { name: string }).name.trim().toLowerCase(), (z as { id: string }).id);
          }
          const missing = neededNames.filter((n) => !zoneByName.has(n.toLowerCase()));
          if (missing.length > 0) zoneWarnings.push(`No se pudieron crear estas zonas: ${missing.join(", ")}`);
        }
      }

      // Zonas que ya existían pero todavía no tenían coordenadas cargadas.
      for (const [zoneNameLower, coords] of coordsByZoneName) {
        if (zoneHasCoords.has(zoneNameLower)) continue;
        const zoneId = zoneByName.get(zoneNameLower);
        if (zoneId) await supabase.from("locations").update({ coordinates: coords }).eq("id", zoneId);
      }

      // Para no duplicar en reimportaciones: traemos los artículos que ya
      // vinieron de un Excel antes (nunca los cargados a mano) para poder
      // actualizar en vez de crear de nuevo. Prioridad de match: código de
      // ITEM primero, y si no hay o no matchea, el serial real (nunca el
      // nombre solo — hay nombres repetidos que son unidades distintas).
      const { data: existingImported } = await supabase.from("machines").select("id, item_code, serial").eq("source", "import");
      const byItemCode = new Map((existingImported ?? []).filter((m) => m.item_code).map((m) => [m.item_code as string, m.id]));
      const bySerial = new Map((existingImported ?? []).filter((m) => m.serial).map((m) => [m.serial as string, m.id]));
      const seenExistingIds = new Set<string>();

      let createdCount = 0;
      let updatedCount = 0;

      for (const r of valid) {
        const payload = {
          name: r.name,
          item_type: r.item_type?.toLowerCase() || "equipo",
          item_code: r.item_code,
          serial: r.serial,
          category: r.category,
          notes: r.notes,
          purchase_date: r.purchase_date,
          inventory_date: r.inventory_date,
          quantity: r.quantity,
          purchase_price: r.unit_price,
          purchase_price_currency: fileCurrency,
          purchase_price_fx_rate: 1,
          status: "disponible",
          location_id: r.location_name ? zoneByName.get(r.location_name.trim().toLowerCase()) ?? null : null,
          temporary_location: r.temporary_location,
          source: "import" as const,
        };

        const existingId = (r.item_code && byItemCode.get(r.item_code)) || (r.serial && bySerial.get(r.serial)) || null;
        if (existingId) {
          seenExistingIds.add(existingId);
          const { error: updErr } = await supabase.from("machines").update(payload).eq("id", existingId);
          if (updErr) {
            setError("No se pudo completar la importación. Revisá que los datos sean válidos.");
            return;
          }
          updatedCount++;
        } else {
          const { error: insErr } = await supabase.from("machines").insert(payload);
          if (insErr) {
            setError("No se pudo completar la importación. Revisá que los datos sean válidos.");
            return;
          }
          createdCount++;
        }
      }

      // Artículos que ya estaban importados pero no aparecieron en este
      // archivo: no se borran, solo se cuentan para avisar que puede que
      // falten en el último conteo.
      const notFoundCount = (existingImported ?? []).filter((m) => !seenExistingIds.has(m.id)).length;
      const ignoredCount = rows.length - valid.length;
      const totalValue = valid.reduce((s, r) => s + (r.unit_price ?? 0) * r.quantity, 0);

      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("import_logs").insert({
        file_name: fileName,
        uploaded_by_email: userData.user?.email ?? null,
        mode: "update",
        created_count: createdCount,
        updated_count: updatedCount,
        unchanged_count: 0,
        ignored_count: ignoredCount,
        not_found_count: notFoundCount,
        total_value: totalValue,
        total_value_currency: fileCurrency,
      });

      await logAudit(
        "machine",
        null,
        "importación desde Excel",
        `${createdCount} creado(s), ${updatedCount} actualizado(s), ${notFoundCount} no encontrado(s) en este conteo`
      );
      setDone({ created: createdCount, updated: updatedCount, notFound: notFoundCount, ignored: ignoredCount, totalValue, zoneWarnings });
      setRows([]);
      setColumnMap([]);
      setUnmatchedHeaders([]);
      setFileName("");
      onDone();
    } finally {
      setImporting(false);
    }
  }

  const validRows = rows.filter((r) => !r.error);
  const validCount = validRows.length;
  const errorCount = rows.length - validCount;
  const validQuantity = validRows.reduce((s, r) => s + r.quantity, 0);
  const validValue = validRows.reduce((s, r) => s + (r.unit_price ?? 0) * r.quantity, 0);

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
          <p className="text-base font-medium text-ok">✓ ¡Listo!</p>
          <p className="text-sm text-ink mt-1">
            Se crearon {done.created} artículo(s), se actualizaron {done.updated}.
            {done.ignored > 0 && ` Se ignoraron ${done.ignored} fila(s) con problemas.`}
            {done.notFound > 0 && ` ${done.notFound} artículo(s) ya cargados no aparecieron en este archivo — no se borraron, pero puede que falten en el último conteo.`}
          </p>
          <p className="text-sm text-steel mt-1">
            Valor total del archivo: {fileCurrency} {done.totalValue.toLocaleString("es-AR")}
          </p>
          {done.zoneWarnings.length > 0 && (
            <div className="bg-warn/10 border border-warn/20 rounded-tag px-3 py-2 mt-2">
              {done.zoneWarnings.map((w, i) => (
                <p key={i} className="text-xs text-warn">⚠ {w}</p>
              ))}
            </div>
          )}
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
              <label className="flex items-center gap-2 text-sm text-steel mb-3">
                Moneda de los costos de este archivo:
                <select
                  value={fileCurrency}
                  onChange={(e) => setFileCurrency(e.target.value)}
                  className="focus-ring border border-line rounded-tag px-2 py-1 text-sm"
                >
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </label>
              <p className="text-sm text-steel mb-2">
                <span className="text-ok font-medium">{validCount} artículo(s) listos</span> para cargar
                {errorCount > 0 && <span className="text-warn"> · {errorCount} fila(s) con problema, no se van a cargar</span>}
              </p>
              <div className="bg-base rounded-tag p-3 mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="text-steel">
                  Cantidad total: <span className="text-ink font-medium">{validQuantity.toLocaleString("es-AR")}</span>
                </span>
                <span className="text-steel">
                  Valor total ({fileCurrency}): <span className="text-ink font-medium">{validValue.toLocaleString("es-AR")}</span>
                </span>
              </div>
              <p className="text-[11px] text-steel mb-2">
                Estos totales son la suma de las filas válidas de arriba — no los copiamos de ninguna fila "total" que
                tenga tu archivo, se calculan de nuevo acá.
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

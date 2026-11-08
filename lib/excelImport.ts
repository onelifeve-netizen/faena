export interface ParsedRow {
  name: string;
  item_type: string | null;
  serial: string | null;
  quantity: number;
  unit_price: number | null;
  location_name: string | null;
  notes: string | null;
  purchase_date: string | null;
  category: string | null;
  rowNumber: number;
  error: string | null;
}

type Field = "name" | "item_type" | "serial" | "unit_price" | "location_name" | "notes" | "purchase_date" | "category" | "quantity" | "total_cost";

// Sinónimos conocidos por campo. El primero de cada lista es el "nombre
// canónico" del campo, usado también como referencia para el match difuso.
const SYNONYMS: Record<Field, string[]> = {
  name: ["descripcion", "nombre", "articulo", "item", "equipo", "producto", "detalle"],
  item_type: ["tipo", "tipo de articulo", "categoria de tipo", "clase"],
  serial: ["serial", "n de serie", "nro de serie", "numero de serie", "codigo", "n serie", "serie"],
  quantity: ["cantidad", "cant", "qty", "unidades", "stock"],
  unit_price: ["costo unidad", "costo unitario", "precio unitario", "costo por unidad", "precio", "costo"],
  total_cost: ["costo total", "costo inventario total", "valor total", "importe total"],
  location_name: ["ubicacion", "ubicacion temporal", "ubicacion principal", "zona", "almacen", "patio", "deposito", "lugar"],
  notes: ["observacion", "observaciones", "nota", "notas", "comentario", "comentarios"],
  purchase_date: ["fecha", "fecha de compra", "fecha de ingreso"],
  category: ["categoria", "rubro", "familia"],
};

function normalize(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[_\-.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return 1 - levenshtein(a, b) / maxLen;
}

function bestFieldMatch(header: string): { field: Field; score: number } | null {
  let best: { field: Field; score: number } | null = null;
  for (const field of Object.keys(SYNONYMS) as Field[]) {
    for (const syn of SYNONYMS[field]) {
      const score = similarity(header, syn);
      if (!best || score > best.score) best = { field, score };
    }
  }
  return best;
}

// Resuelve, para un conjunto de encabezados de columna, a qué campo
// corresponde cada uno — exacto primero, y para lo que no matchea exacto,
// la coincidencia más cercana por similitud de texto (no hace falta que el
// encabezado sea idéntico al esperado).
function buildColumnMap(headers: string[]): Record<string, Field> {
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalize(h) }));
  const map: Record<string, Field> = {};
  const usedFields = new Set<Field>();

  // 1) match exacto
  for (const { raw, norm } of normalizedHeaders) {
    for (const field of Object.keys(SYNONYMS) as Field[]) {
      if (SYNONYMS[field].includes(norm) && !usedFields.has(field)) {
        map[raw] = field;
        usedFields.add(field);
        break;
      }
    }
  }

  // 2) para lo que quedó sin mapear, la coincidencia más cercana por encima
  //    de un umbral razonable, asignando primero los matches más fuertes.
  const candidates: { raw: string; field: Field; score: number }[] = [];
  for (const { raw, norm } of normalizedHeaders) {
    if (map[raw]) continue;
    const best = bestFieldMatch(norm);
    if (best && best.score >= 0.55) candidates.push({ raw, field: best.field, score: best.score });
  }
  candidates.sort((a, b) => b.score - a.score);
  for (const c of candidates) {
    if (map[c.raw] || usedFields.has(c.field)) continue;
    map[c.raw] = c.field;
    usedFields.add(c.field);
  }

  return map;
}

export const FIELD_LABELS: Record<Field, string> = {
  name: "Nombre",
  item_type: "Tipo",
  serial: "Serial",
  quantity: "Cantidad",
  unit_price: "Costo unidad",
  total_cost: "Costo total",
  location_name: "Ubicación",
  notes: "Observación",
  purchase_date: "Fecha",
  category: "Categoría",
};

export interface ParseResult {
  rows: ParsedRow[];
  columnMap: { header: string; field: string }[];
  unmatchedHeaders: string[];
}

export async function parseExcelFile(file: File): Promise<ParseResult> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (rows.length === 0) return { rows: [], columnMap: [], unmatchedHeaders: [] };

  const allHeaders = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const columnMap = buildColumnMap(allHeaders);
  const columnMapList = Object.entries(columnMap).map(([header, field]) => ({ header, field: FIELD_LABELS[field] }));
  const unmatchedHeaders = allHeaders.filter((h) => !columnMap[h]);

  const parsedRows = rows.map((row, i) => {
    const mapped: Partial<Record<Field, string>> = {};
    for (const [rawKey, rawValue] of Object.entries(row)) {
      const field = columnMap[rawKey];
      if (!field || rawValue === "" || rawValue == null) continue;
      mapped[field] = rawValue instanceof Date ? rawValue.toISOString().slice(0, 10) : String(rawValue).trim();
    }

    let quantity = 1;
    if (mapped.quantity) {
      const n = Number(mapped.quantity);
      if (!isNaN(n) && n > 0) quantity = Math.floor(n);
    }

    let unitPrice: number | null = null;
    if (mapped.unit_price) {
      const n = Number(mapped.unit_price);
      if (!isNaN(n)) unitPrice = n;
    }
    if (unitPrice == null && mapped.total_cost) {
      const total = Number(mapped.total_cost);
      if (!isNaN(total) && quantity > 0) unitPrice = total / quantity;
    }

    const name = mapped.name?.trim() || "";
    return {
      name,
      item_type: mapped.item_type ?? null,
      serial: mapped.serial ?? null,
      quantity,
      unit_price: unitPrice,
      location_name: mapped.location_name ?? null,
      notes: mapped.notes ?? null,
      purchase_date: mapped.purchase_date ?? null,
      category: mapped.category ?? null,
      rowNumber: i + 2,
      error: name ? null : "Falta la descripción/nombre",
    };
  });

  return { rows: parsedRows, columnMap: columnMapList, unmatchedHeaders };
}

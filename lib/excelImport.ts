export interface ParsedRow {
  name: string;
  item_type: string | null;
  item_code: string | null;
  serial: string | null;
  quantity: number;
  unit_price: number | null;
  location_name: string | null;
  temporary_location: string | null;
  coordinates: string | null;
  notes: string | null;
  purchase_date: string | null;
  inventory_date: string | null;
  category: string | null;
  rowNumber: number;
  error: string | null;
}

type Field =
  | "name"
  | "item_type"
  | "item_code"
  | "serial"
  | "unit_price"
  | "location_name"
  | "temporary_location"
  | "coordinates"
  | "notes"
  | "purchase_date"
  | "inventory_date"
  | "category"
  | "quantity"
  | "total_cost";

// Sinónimos conocidos por campo. El primero de cada lista es el "nombre
// canónico" del campo, usado también como referencia para el match difuso.
const SYNONYMS: Record<Field, string[]> = {
  // "item"/"n" NO van acá a propósito: en la mayoría de las planillas reales
  // esa columna es solo el número de fila, no el nombre del artículo — si se
  // incluye, le roba el lugar a la columna real de descripción.
  name: ["descripcion", "nombre", "articulo", "equipo", "producto", "detalle"],
  item_type: ["tipo", "tipo de articulo", "categoria de tipo", "clase"],
  // El código/número de ITEM de la planilla (clave de upsert para no
  // duplicar en reimportaciones). "item" va acá, no en "name" ni en
  // "serial" — es un número de identificación, no una descripción ni un
  // número de serie de fábrica.
  item_code: ["item", "codigo de identificacion", "codigo item", "nro item", "numero de item", "n item"],
  serial: ["serial", "n de serie", "nro de serie", "numero de serie", "n serie", "serie"],
  quantity: ["cantidad", "cant", "qty", "unidades", "stock"],
  unit_price: ["costo unidad", "costo unitario", "precio unitario", "costo por unidad", "precio", "costo"],
  total_cost: ["costo total", "costo inventario total", "valor total", "importe total"],
  // La zona/ubicación fija (dónde vive el artículo normalmente). Ojo: NO
  // incluye "ubicacion temporal" — eso es un campo distinto (ver abajo),
  // porque en archivos reales son dos columnas separadas con significados
  // opuestos (zona fija vs. dónde está ahora).
  location_name: ["ubicacion en almacen", "ubicacion en almacen patio", "ubicacion principal", "zona", "almacen", "patio", "deposito", "ubicacion"],
  // "Dónde está ahora" — puede ser un vehículo, una obra, otro contenedor,
  // etc. — distinto de la zona fija de almacenamiento.
  temporary_location: ["ubicacion temporal", "ubicacion actual", "ubicacion provisoria", "donde esta"],
  // Coordenadas GPS de la ubicación fija — van primero en el orden de
  // evaluación (antes que location_name) porque sin esto "COORDENADAS DE
  // UBICACION FIJA" matchearía como una ubicación más por contener
  // "ubicacion".
  coordinates: ["coordenadas", "coordenadas de ubicacion fija", "coordenadas gps", "gps", "latitud longitud", "ubicacion gps"],
  notes: ["observacion", "observaciones", "nota", "notas", "comentario", "comentarios"],
  purchase_date: ["fecha de compra", "fecha de ingreso", "fecha de adquisicion"],
  // FECHA sola (sin "de compra") es la fecha del conteo/inventario, no de
  // compra — son cosas distintas en la realidad (ver spec del usuario).
  inventory_date: ["fecha", "fecha de conteo", "fecha de inventario", "fecha de relevamiento"],
  category: ["categoria", "rubro", "familia"],
};

function normalize(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[_\-.$()%/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Códigos de una sola letra que suelen usarse en planillas reales para el
// tipo de artículo (ej: R = Repuesto). Si la columna Tipo trae esto en vez
// de la palabra completa, se expande para que coincida con los tipos que
// ya usa el sistema.
const TYPE_ABBREVIATIONS: Record<string, string> = {
  e: "equipo",
  a: "accesorio",
  r: "repuesto",
  h: "herramienta",
  c: "consumible",
  o: "otros",
};

// Categoría (para el donut/filtros) a partir del tipo expandido — así nada
// queda en "Sin categoría" cuando la planilla solo trae la letra de TIPO.
const CATEGORY_BY_TYPE: Record<string, string> = {
  equipo: "Equipos",
  accesorio: "Accesorios",
  repuesto: "Repuestos",
  herramienta: "Herramientas",
  consumible: "Consumibles",
  otros: "Otros",
};

function expandItemType(value: string): string {
  const key = value.trim().toLowerCase();
  return TYPE_ABBREVIATIONS[key] ?? value.trim();
}

// Normaliza seriales: valores como "N/A", "??", "-", vacíos no son un serial
// real y se guardan como null en vez de texto literal.
function normalizeSerial(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^(n\/?a|s\/n|sin serial|-+|\?+)$/i.test(v)) return null;
  return v;
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
  const matches = allFieldMatches(header);
  return matches[0] ?? null;
}

// Devuelve TODOS los campos que coinciden razonablemente con un encabezado,
// de mejor a peor — no solo el mejor. Hace falta para el caso en que una
// columna empata o casi empata entre dos campos (ej: "costo" vs "costo
// inventario total" para "COSTO INVENTARIO"): si el campo que ganó ya está
// ocupado por otra columna, igual hay que poder usar el segundo mejor en
// vez de descartar la columna entera.
function allFieldMatches(header: string): { field: Field; score: number }[] {
  const best: Partial<Record<Field, number>> = {};
  for (const field of Object.keys(SYNONYMS) as Field[]) {
    for (const syn of SYNONYMS[field]) {
      const score = similarity(header, syn);
      if (best[field] == null || score > best[field]!) best[field] = score;
    }
  }
  return (Object.entries(best) as [Field, number][]).sort((a, b) => b[1] - a[1]).map(([field, score]) => ({ field, score }));
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

  // 2) para lo que quedó sin mapear, todas las coincidencias razonables de
  //    cada columna (no solo la mejor), asignando primero los matches más
  //    fuertes — así, si el campo ganador de una columna ya lo ocupó otra,
  //    todavía puede caer en su segunda mejor opción en vez de perderse.
  const candidates: { raw: string; field: Field; score: number }[] = [];
  for (const { raw, norm } of normalizedHeaders) {
    if (map[raw]) continue;
    for (const m of allFieldMatches(norm)) {
      if (m.score >= 0.55) candidates.push({ raw, field: m.field, score: m.score });
    }
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
  item_code: "Código (ITEM)",
  serial: "Serial",
  quantity: "Cantidad",
  unit_price: "Costo unidad",
  total_cost: "Costo total",
  location_name: "Zona",
  temporary_location: "Ubicación temporal",
  coordinates: "Coordenadas (de la zona)",
  notes: "Observación",
  purchase_date: "Fecha de compra",
  inventory_date: "Fecha de conteo",
  category: "Categoría",
};

export interface ParseResult {
  rows: ParsedRow[];
  columnMap: { header: string; field: string }[];
  unmatchedHeaders: string[];
  headerRowSkipped: number;
}

// Muchas planillas reales tienen un título y/o filas en blanco antes de la
// fila de encabezados de verdad (ej: "INVENTARIO" en la fila 1, encabezados
// recién en la fila 5). En vez de asumir que los encabezados están siempre
// en la primera fila, se escanean las primeras filas y se elige la que más
// se parece a una fila de encabezados conocidos.
function detectHeaderRow(matrix: unknown[][]): number {
  let bestRow = 0;
  let bestScore = -1;
  const scanLimit = Math.min(matrix.length, 30);
  for (let i = 0; i < scanLimit; i++) {
    const row = matrix[i] ?? [];
    let matchCount = 0;
    let nonEmptyCount = 0;
    for (const cell of row) {
      const text = cell == null ? "" : String(cell).trim();
      if (!text) continue;
      nonEmptyCount++;
      const best = allFieldMatches(normalize(text))[0];
      if (best && best.score >= 0.55) matchCount++;
    }
    const score = matchCount * 1000 + nonEmptyCount;
    if (matchCount > 0 && score > bestScore) {
      bestScore = score;
      bestRow = i;
    }
  }
  return bestRow;
}

export async function parseExcelFile(file: File): Promise<ParseResult> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rawMatrix: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  if (rawMatrix.length === 0) return { rows: [], columnMap: [], unmatchedHeaders: [], headerRowSkipped: 0 };
  const headerRowIndex = detectHeaderRow(rawMatrix);

  // Se arman los objetos a mano, columna por columna según el texto real de
  // la fila de encabezados detectada — no se delega en el "range" numérico
  // de sheet_to_json, que con filas vacías arriba puede terminar generando
  // claves genéricas ("__EMPTY") en vez de usar el texto real del encabezado.
  //
  // "range" como número es un índice ABSOLUTO contra toda la hoja, pero
  // headerRowIndex está calculado relativo a donde arranca el rango real de
  // la hoja (sheet["!ref"]) — si no se sabe eso, con filas vacías arriba
  // termina leyendo la fila equivocada (devuelve el propio encabezado como
  // si fuera un dato, o se corre de fila).
  const sheetStartRow = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1").s.r;
  const headerCells = (rawMatrix[headerRowIndex] ?? []).map((h) => (h == null ? "" : String(h).trim()));
  const dataMatrix: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", range: sheetStartRow + headerRowIndex + 1 });
  const rows: Record<string, unknown>[] = [];
  const rowOriginalIndex: number[] = [];
  dataMatrix.forEach((r, idx) => {
    if (!r.some((cell) => cell !== "" && cell != null)) return; // ignora filas totalmente vacías (sobran al final de muchas planillas)
    const obj: Record<string, unknown> = {};
    headerCells.forEach((h, i) => {
      if (h) obj[h] = r[i] ?? "";
    });
    rows.push(obj);
    rowOriginalIndex.push(idx);
  });
  if (rows.length === 0) return { rows: [], columnMap: [], unmatchedHeaders: [], headerRowSkipped: headerRowIndex };

  const allHeaders = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const columnMap = buildColumnMap(allHeaders);

  // Si la planilla trae una columna de ubicación extra que no se reconoció
  // como zona fija ni como "ubicación temporal" explícita (ej. nombres poco
  // usuales), se guarda igual como ubicación temporal en vez de perderla.
  let secondaryLocationHeader: string | null = null;
  if (!Object.values(columnMap).includes("temporary_location")) {
    for (const h of allHeaders) {
      if (columnMap[h]) continue;
      const best = bestFieldMatch(normalize(h));
      if (best && best.field === "location_name" && best.score >= 0.55) {
        secondaryLocationHeader = h;
        break;
      }
    }
  }

  const columnMapList = Object.entries(columnMap).map(([header, field]) => ({ header, field: FIELD_LABELS[field] }));
  if (secondaryLocationHeader) {
    columnMapList.push({ header: secondaryLocationHeader, field: "Ubicación temporal (adicional)" });
  }
  const unmatchedHeaders = allHeaders.filter((h) => !columnMap[h] && h !== secondaryLocationHeader);
  const hasItemCodeColumn = Object.values(columnMap).includes("item_code");

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

    let temporaryLocation = mapped.temporary_location?.trim() || null;
    if (secondaryLocationHeader && !temporaryLocation) {
      const tempLocationValue = row[secondaryLocationHeader];
      if (tempLocationValue !== "" && tempLocationValue != null) {
        temporaryLocation = String(tempLocationValue).trim();
      }
    }

    const notes = mapped.notes?.trim() || null;
    const expandedType = mapped.item_type ? expandItemType(mapped.item_type) : null;
    const category = mapped.category?.trim() || (expandedType ? CATEGORY_BY_TYPE[expandedType.toLowerCase()] ?? null : null);

    const name = mapped.name?.trim() || "";
    const itemCode = mapped.item_code?.trim() || null;
    const itemCodeNum = itemCode != null ? Number(itemCode) : null;
    const itemCodeInvalid = hasItemCodeColumn && (itemCodeNum == null || isNaN(itemCodeNum) || itemCodeNum <= 0);

    return {
      name,
      item_type: expandedType,
      item_code: itemCode,
      serial: mapped.serial ? normalizeSerial(mapped.serial) : null,
      quantity,
      unit_price: unitPrice,
      location_name: mapped.location_name ?? null,
      temporary_location: temporaryLocation,
      coordinates: mapped.coordinates?.trim() || null,
      notes,
      purchase_date: mapped.purchase_date ?? null,
      inventory_date: mapped.inventory_date ?? null,
      category,
      rowNumber: headerRowIndex + rowOriginalIndex[i] + 2,
      error: !name ? "Falta la descripción/nombre" : itemCodeInvalid ? "El código de ITEM no es válido" : null,
    };
  });

  // Un mismo código de ITEM repetido dentro del archivo es un error de la
  // planilla, no algo para resolver en silencio (sería ambiguo a cuál de
  // las dos filas hacerle upsert). Se deja la primera aparición como está y
  // se marca error en las siguientes.
  const seenItemCodes = new Set<string>();
  for (const r of parsedRows) {
    if (r.error || !r.item_code) continue;
    if (seenItemCodes.has(r.item_code)) {
      r.error = `Código de ITEM "${r.item_code}" repetido en el archivo`;
    } else {
      seenItemCodes.add(r.item_code);
    }
  }

  return { rows: parsedRows, columnMap: columnMapList, unmatchedHeaders, headerRowSkipped: headerRowIndex };
}

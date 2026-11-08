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

const HEADER_MAP: Record<string, keyof Omit<ParsedRow, "rowNumber" | "error" | "quantity">> = {
  descripcion: "name",
  nombre: "name",
  articulo: "name",
  item: "name",
  equipo: "name",
  tipo: "item_type",
  serial: "serial",
  "n de serie": "serial",
  "nro de serie": "serial",
  "numero de serie": "serial",
  codigo: "serial",
  "costo unidad": "unit_price",
  "costo unitario": "unit_price",
  "precio unitario": "unit_price",
  "costo por unidad": "unit_price",
  ubicacion: "location_name",
  "ubicacion temporal": "location_name",
  "ubicacion principal": "location_name",
  zona: "location_name",
  almacen: "location_name",
  patio: "location_name",
  observacion: "notes",
  observaciones: "notes",
  nota: "notes",
  notas: "notes",
  fecha: "purchase_date",
  "fecha de compra": "purchase_date",
  categoria: "category",
};

function normalize(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export async function parseExcelFile(file: File): Promise<ParsedRow[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const costTotalKeys = ["costo total", "costo inventario total", "valor total"];
  const quantityKeys = ["cantidad", "cant", "qty"];

  return rows.map((row, i) => {
    const mapped: Partial<ParsedRow> = {};
    let quantity = 1;
    let totalCost: number | null = null;

    for (const [rawKey, rawValue] of Object.entries(row)) {
      const key = normalize(rawKey);
      if (quantityKeys.includes(key)) {
        const n = Number(rawValue);
        if (!isNaN(n) && n > 0) quantity = Math.floor(n);
        continue;
      }
      if (costTotalKeys.includes(key)) {
        const n = Number(rawValue);
        if (!isNaN(n)) totalCost = n;
        continue;
      }
      const field = HEADER_MAP[key];
      if (!field || rawValue === "" || rawValue == null) continue;
      if (field === "unit_price") {
        const n = Number(rawValue);
        if (!isNaN(n)) mapped.unit_price = n;
      } else if (field === "purchase_date") {
        mapped.purchase_date = rawValue instanceof Date ? rawValue.toISOString().slice(0, 10) : String(rawValue);
      } else {
        (mapped as any)[field] = String(rawValue).trim();
      }
    }

    if (mapped.unit_price == null && totalCost != null && quantity > 0) {
      mapped.unit_price = totalCost / quantity;
    }

    const name = mapped.name?.trim() || "";
    return {
      name,
      item_type: mapped.item_type ?? null,
      serial: mapped.serial ?? null,
      quantity,
      unit_price: mapped.unit_price ?? null,
      location_name: mapped.location_name ?? null,
      notes: mapped.notes ?? null,
      purchase_date: mapped.purchase_date ?? null,
      category: mapped.category ?? null,
      rowNumber: i + 2,
      error: name ? null : "Falta la descripción/nombre",
    };
  });
}

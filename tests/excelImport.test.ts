import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseExcelFile } from "../lib/excelImport";

// parseExcelFile espera un File del navegador (con .arrayBuffer()). Se
// simula a mano con el buffer real leído del disco, igual que en el browser.
function loadFixture(name: string) {
  const buf = readFileSync(path.join(__dirname, "fixtures", name));
  return {
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  } as unknown as File;
}

describe("parseExcelFile — planilla real MATRIZ_DE_INVENTARIO_FISICO.xlsx", () => {
  it("detecta la fila de encabezados reales, saltando título y filas vacías", async () => {
    const result = await parseExcelFile(loadFixture("MATRIZ_DE_INVENTARIO_FISICO.xlsx"));
    expect(result.headerRowSkipped).toBe(5);
  });

  it("reconoce todas las columnas de la planilla, sin dejar ninguna sin usar", async () => {
    const result = await parseExcelFile(loadFixture("MATRIZ_DE_INVENTARIO_FISICO.xlsx"));
    expect(result.unmatchedHeaders).toEqual([]);
    const fields = result.columnMap.map((c) => c.field);
    expect(fields).toContain("Código (ITEM)");
    expect(fields).toContain("Nombre");
    expect(fields).toContain("Zona");
    expect(fields).toContain("Ubicación temporal");
  });

  it("da exactamente 92 artículos válidos, 10 filas con error", async () => {
    const result = await parseExcelFile(loadFixture("MATRIZ_DE_INVENTARIO_FISICO.xlsx"));
    const valid = result.rows.filter((r) => !r.error);
    const invalid = result.rows.filter((r) => r.error);
    expect(valid.length).toBe(92);
    expect(invalid.length).toBe(10);
  });

  it("suma CANTIDAD = 175 y valor total (cantidad x costo unidad) = 42.348", async () => {
    const result = await parseExcelFile(loadFixture("MATRIZ_DE_INVENTARIO_FISICO.xlsx"));
    const valid = result.rows.filter((r) => !r.error);
    const sumQty = valid.reduce((s, r) => s + r.quantity, 0);
    const sumValue = valid.reduce((s, r) => s + (r.unit_price ?? 0) * r.quantity, 0);
    expect(sumQty).toBe(175);
    expect(sumValue).toBe(42348);
  });

  it("no deja ningún artículo válido sin categoría", async () => {
    const result = await parseExcelFile(loadFixture("MATRIZ_DE_INVENTARIO_FISICO.xlsx"));
    const valid = result.rows.filter((r) => !r.error);
    expect(valid.every((r) => !!r.category)).toBe(true);
  });

  it("usa UBICACIÓN EN ALMACEN PATIO como zona y UBICACIÓN TEMPORAL como ubicación temporal (no al revés)", async () => {
    const result = await parseExcelFile(loadFixture("MATRIZ_DE_INVENTARIO_FISICO.xlsx"));
    const manguera = result.rows.find((r) => r.name.startsWith("MANGUERA DE ALTA PRESION 20.000PSI"));
    expect(manguera?.location_name).toBe("CAJON RHD");
    expect(manguera?.temporary_location).toBe("KANGOO");
  });

  it("normaliza seriales inválidos (N/A, ??, -) a null en vez de guardarlos literales", async () => {
    const result = await parseExcelFile(loadFixture("MATRIZ_DE_INVENTARIO_FISICO.xlsx"));
    const valid = result.rows.filter((r) => !r.error);
    expect(valid.some((r) => r.serial && /n\/?a|\?/i.test(r.serial))).toBe(false);
  });

  it('mapea el tipo "O" a "otros" en vez de quedar sin reconocer', async () => {
    const result = await parseExcelFile(loadFixture("MATRIZ_DE_INVENTARIO_FISICO.xlsx"));
    const cajones = result.rows.filter((r) => r.name.startsWith("CAJON GRIS") || r.name.startsWith("CAJON NEGRO"));
    expect(cajones.length).toBeGreaterThan(0);
    expect(cajones.every((r) => r.item_type === "otros")).toBe(true);
  });

  it("asigna item_code desde la columna ITEM", async () => {
    const result = await parseExcelFile(loadFixture("MATRIZ_DE_INVENTARIO_FISICO.xlsx"));
    const valid = result.rows.filter((r) => !r.error);
    expect(valid.every((r) => r.item_code && Number(r.item_code) > 0)).toBe(true);
  });

  it("es idempotente: reimportar el mismo archivo da los mismos resultados", async () => {
    const first = await parseExcelFile(loadFixture("MATRIZ_DE_INVENTARIO_FISICO.xlsx"));
    const second = await parseExcelFile(loadFixture("MATRIZ_DE_INVENTARIO_FISICO.xlsx"));
    expect(first.rows.filter((r) => !r.error).length).toBe(second.rows.filter((r) => !r.error).length);
    expect(first.rows.map((r) => r.item_code)).toEqual(second.rows.map((r) => r.item_code));
  });
});

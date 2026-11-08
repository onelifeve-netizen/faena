// Sugerencias por defecto (se guardan en minúscula, igual que ya quedaron
// las máquinas existentes vía migration_017) — no es una lista cerrada,
// machines.item_type es texto libre (ver migration_018_tipo_libre.sql) para
// que cada empresa pueda agregar los tipos que le falten.
export const DEFAULT_ITEM_TYPES = ["equipo", "accesorio", "repuesto", "herramienta", "consumible"];

export const ITEM_TYPE_LABELS: Record<string, string> = {
  equipo: "Equipo",
  accesorio: "Accesorio",
  repuesto: "Repuesto",
  herramienta: "Herramienta",
  consumible: "Consumible",
};

export function itemTypeLabel(t: string): string {
  return ITEM_TYPE_LABELS[t] ?? (t.charAt(0).toUpperCase() + t.slice(1));
}

export const CONDITION_LABELS: Record<string, string> = {
  bueno: "Bueno",
  regular: "Regular",
  malo: "Malo",
  reponer: "Necesita reposición",
};

export const CONDITION_STYLES: Record<string, string> = {
  bueno: "bg-ok/10 text-ok",
  regular: "bg-info/10 text-info",
  malo: "bg-warn/10 text-warn",
  reponer: "bg-warn/20 text-warn",
};

export const ITEM_TYPE_GLOSSARY: Record<string, string> = {
  equipo: "Máquina o unidad principal, se identifica sola (ej: retroexcavadora, generador).",
  accesorio: "Va siempre junto a un equipo, no se usa solo (ej: balde, pala, acople).",
  repuesto: "Pieza de recambio para reparar o mantener un equipo (ej: filtro, correa, rodamiento).",
  herramienta: "De uso manual, se desgasta con el uso (ej: taladro, amoladora, llave).",
  consumible: "Se gasta y no vuelve (ej: aceite, combustible, electrodos, guantes).",
};

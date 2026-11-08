import { ItemType } from "./types";

export const ITEM_TYPES: ItemType[] = ["equipo", "accesorio", "repuesto", "herramienta", "consumible"];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  equipo: "Equipo",
  accesorio: "Accesorio",
  repuesto: "Repuesto",
  herramienta: "Herramienta",
  consumible: "Consumible",
};

export const ITEM_TYPE_GLOSSARY: Record<ItemType, string> = {
  equipo: "Máquina o unidad principal, se identifica sola (ej: retroexcavadora, generador).",
  accesorio: "Va siempre junto a un equipo, no se usa solo (ej: balde, pala, acople).",
  repuesto: "Pieza de recambio para reparar o mantener un equipo (ej: filtro, correa, rodamiento).",
  herramienta: "De uso manual, se desgasta con el uso (ej: taladro, amoladora, llave).",
  consumible: "Se gasta y no vuelve (ej: aceite, combustible, electrodos, guantes).",
};

export const CURRENCIES = ["ARS", "USD", "EUR", "BRL", "UYU", "CLP"];

/** Convierte un monto a la moneda de referencia usando la cotización cargada manualmente. */
export function toReference(amount: number, fxRate: number): number {
  return amount * fxRate;
}

export function formatMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

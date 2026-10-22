"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/currency";

/**
 * Input de cotización con vista previa en vivo y una ayuda para calcular la
 * cotización "al revés": mucha gente conoce el tipo de cambio como "1 USD =
 * 1500 ARS", que es el INVERSO de lo que esta app necesita (cuánto vale 1
 * unidad de la moneda del gasto en la moneda de referencia). Cargar esa
 * cotización directa sin darse cuenta multiplica por 1500 en vez de dividir,
 * y el monto convertido queda mil veces más grande de lo real.
 */
export default function FxRateField({
  amount,
  currency,
  refCurrency,
  fxRate,
  onFxRateChange,
  className,
}: {
  amount: string | number;
  currency: string;
  refCurrency: string;
  fxRate: string;
  onFxRateChange: (v: string) => void;
  className?: string;
}) {
  const [showHelper, setShowHelper] = useState(false);
  const [inverse, setInverse] = useState("");

  const converted = Number(amount || 0) * Number(fxRate || 0);
  const sameCurrency = currency === refCurrency;

  function handleInverseChange(v: string) {
    setInverse(v);
    const n = Number(v);
    if (n > 0) onFxRateChange(String(1 / n));
  }

  if (sameCurrency) return null;

  return (
    <div className={className}>
      <input
        className="focus-ring w-full border border-line rounded-tag px-3 py-1.5 text-sm"
        placeholder={`Cotización a ${refCurrency}`}
        type="number"
        step="0.000001"
        value={fxRate}
        onChange={(e) => onFxRateChange(e.target.value)}
      />
      {Number(amount) > 0 && Number(fxRate) > 0 && (
        <p className="text-[11px] text-steel mt-1">≈ {formatMoney(converted, refCurrency)}</p>
      )}
      <button
        type="button"
        onClick={() => setShowHelper((s) => !s)}
        className="focus-ring text-[11px] text-accent font-mono hover:underline mt-0.5"
      >
        {showHelper ? "ocultar ayuda" : "¿no sabés la cotización así? tocá acá"}
      </button>
      {showHelper && (
        <div className="mt-1.5 bg-base rounded-tag p-2">
          <label className="block text-[11px] text-steel">
            ¿Cuántos {currency} vale 1 {refCurrency}?
            <input
              className="focus-ring mt-1 w-full border border-line rounded-tag px-2 py-1 text-xs"
              type="number"
              placeholder={`Ej: 1500`}
              value={inverse}
              onChange={(e) => handleInverseChange(e.target.value)}
            />
          </label>
          <p className="text-[10px] text-steel mt-1">Completá esto y la cotización de arriba se calcula sola.</p>
        </div>
      )}
    </div>
  );
}

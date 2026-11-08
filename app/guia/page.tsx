"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";

interface GuiaData {
  company_name: string;
  machine_name: string;
  machine_serial: string;
  machine_category: string;
  from_location: string | null;
  to_location: string;
  note: string | null;
  created_by_email: string | null;
  created_at: string;
}

export default function Guia() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-steel">Cargando...</p>}>
      <GuiaInner />
    </Suspense>
  );
}

function GuiaInner() {
  const token = useSearchParams().get("token") ?? "";
  const [data, setData] = useState<GuiaData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("Falta el token de la guía.");
      setLoading(false);
      return;
    }
    fetchGuia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function fetchGuia() {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL as string}/functions/v1/guia-publica?token=${encodeURIComponent(token)}`,
        { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string } }
      );
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? "No se pudo cargar la guía.");
      } else {
        setData(json);
      }
    } catch {
      setError("No se pudo cargar la guía.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-base py-8 px-4 print:bg-white print:py-0">
      <div className="max-w-xl mx-auto bg-white border border-line rounded-tag shadow-card p-8 print:shadow-none print:border-0">
        {loading ? (
          <p className="text-sm text-steel">Cargando...</p>
        ) : error ? (
          <p className="text-sm text-warn">{error}</p>
        ) : data ? (
          <>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-line">
              <div className="flex items-center gap-2">
                <Logo size={28} />
                <span className="font-display font-bold text-ink">{data.company_name || "Faena"}</span>
              </div>
              <button onClick={() => window.print()} className="focus-ring text-xs text-accent font-mono hover:underline print:hidden">
                imprimir / guardar PDF
              </button>
            </div>

            <p className="font-mono text-xs text-steel uppercase tracking-wide mb-1">Comprobante</p>
            <h1 className="font-display font-bold text-2xl text-ink mb-6">Guía de traslado</h1>

            <dl className="space-y-3 text-sm">
              <Row label="Equipo" value={`${data.machine_name}${data.machine_category ? ` (${data.machine_category})` : ""}`} />
              <Row label="N.° de serie" value={data.machine_serial || "sin N.° de serie"} />
              <Row label="Origen" value={data.from_location || "sin registrar"} />
              <Row label="Destino" value={data.to_location} />
              {data.note && <Row label="Observación" value={data.note} />}
              <Row label="Fecha" value={new Date(data.created_at).toLocaleString("es-AR")} />
              {data.created_by_email && <Row label="Generado por" value={data.created_by_email} />}
            </dl>

            <p className="text-[11px] text-steel mt-8 pt-4 border-t border-line">
              Documento generado por Faena — comprobante informal de traslado, no reemplaza documentación legal de transporte si tu jurisdicción la requiere.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line pb-2">
      <dt className="text-steel">{label}</dt>
      <dd className="text-ink font-medium text-right">{value}</dd>
    </div>
  );
}

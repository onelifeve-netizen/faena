// Edge Function de Supabase (Deno). Lector de facturas con IA: recibe la foto
// de una factura (base64) y le pide a Claude que extraiga descripción, monto
// y moneda, para precargar el formulario de "Agregar gasto" de una obra. La
// API key de Claude vive SOLO como secret de Supabase — nunca llega al
// navegador.
//
// Multi-empresa: usa el JWT de quien llama (no la service-role key) — no lee
// tablas de negocio, solo reenvía la imagen a Claude, pero usa un cliente de
// Supabase para controlar el límite diario de uso de IA por empresa.
//
// Deploy: supabase functions deploy leer-factura
// Secrets: ya usa los mismos GEMINI_API_KEY y ANON_KEY que ai-diagnostico.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return Response.json({ error: "falta la sesión del usuario" }, { status: 401, headers: CORS_HEADERS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const DAILY_AI_LIMIT = 50;
  const todayStart = new Date().toISOString().slice(0, 10) + "T00:00:00Z";
  const { count: usageToday } = await supabase
    .from("ai_usage")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart);
  if ((usageToday ?? 0) >= DAILY_AI_LIMIT) {
    return Response.json(
      { error: `Se alcanzó el límite diario de ${DAILY_AI_LIMIT} usos de IA para tu empresa. Probá de nuevo mañana.` },
      { status: 429, headers: CORS_HEADERS }
    );
  }
  await supabase.from("ai_usage").insert({ function_name: "leer-factura" });

  const { image_base64, media_type } = await req.json();
  if (!image_base64 || !media_type) {
    return Response.json({ error: "faltan image_base64 o media_type" }, { status: 400, headers: CORS_HEADERS });
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    return Response.json(
      { error: "falta el secret GEMINI_API_KEY en Supabase" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const prompt = `Esta imagen es una factura o comprobante de gasto. Respondé ÚNICAMENTE con un JSON válido,
sin texto extra ni markdown, con esta forma exacta:
{"description": "proveedor y/o concepto breve", "amount": 1234.56, "currency": "ARS"}

Reglas:
- "description": texto corto (proveedor y concepto), en español.
- "amount": el monto total de la factura, como número (sin símbolos de moneda ni separadores de miles).
- "currency": el código de moneda de 3 letras si se puede inferir (ARS, USD, etc.), o null si no está claro.
Si no podés leer algún dato con confianza, usá null en ese campo puntual, pero siempre devolvé el JSON completo.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: media_type, data: image_base64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 300 },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    return Response.json({ error: "la IA no pudo leer la factura", detail }, { status: 502, headers: CORS_HEADERS });
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  let parsed;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    return Response.json(
      { error: "la IA no devolvió un formato legible, cargá el gasto a mano" },
      { status: 502, headers: CORS_HEADERS }
    );
  }

  return Response.json(parsed, { headers: CORS_HEADERS });
});

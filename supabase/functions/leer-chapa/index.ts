// Edge Function de Supabase (Deno). Lector de chapa/matrícula con IA: recibe
// la foto de la etiqueta de identificación de un equipo y le pide a Claude
// que extraiga marca, modelo, n.° de serie y cualquier otro dato legible,
// para precargar especificaciones técnicas sin tipearlas a mano. La API key
// de Claude vive SOLO como secret de Supabase — nunca llega al navegador.
//
// Multi-empresa: usa el JWT de quien llama — no lee tablas de negocio, solo
// reenvía la imagen a Claude, pero usa un cliente de Supabase para controlar
// el límite diario de uso de IA por empresa.
//
// Deploy: supabase functions deploy leer-chapa
// Secrets: ya usa el mismo ANTHROPIC_API_KEY y ANON_KEY que ai-diagnostico/leer-factura.

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
  await supabase.from("ai_usage").insert({ function_name: "leer-chapa" });

  const { image_base64, media_type } = await req.json();
  if (!image_base64 || !media_type) {
    return Response.json({ error: "faltan image_base64 o media_type" }, { status: 400, headers: CORS_HEADERS });
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    return Response.json(
      { error: "falta el secret ANTHROPIC_API_KEY en Supabase" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const prompt = `Esta imagen es una foto de la chapa/matrícula o etiqueta de identificación de una máquina
o equipo. Respondé ÚNICAMENTE con un JSON válido, sin texto extra ni markdown, con esta forma exacta:
[{"label": "Marca", "value": "..."}, {"label": "Modelo", "value": "..."}, {"label": "N.º de serie", "value": "..."}]

Reglas:
- Incluí solo los datos que puedas leer con confianza razonable (marca, modelo, n.° de serie, año,
  potencia, u otro dato técnico visible en la etiqueta).
- Si no podés leer nada con confianza, devolvé un array vacío: []
- No inventes datos que no estén en la imagen.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type, data: image_base64 } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return Response.json({ error: "la IA no pudo leer la chapa", detail }, { status: 502, headers: CORS_HEADERS });
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";

  let parsed;
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    return Response.json(
      { error: "la IA no devolvió un formato legible, cargá las especificaciones a mano" },
      { status: 502, headers: CORS_HEADERS }
    );
  }

  return Response.json({ specs: parsed }, { headers: CORS_HEADERS });
});

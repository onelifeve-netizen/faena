// Edge Function de Supabase (Deno). Lector de facturas con IA: recibe la foto
// de una factura (base64) y le pide a Claude que extraiga descripción, monto
// y moneda, para precargar el formulario de "Agregar gasto" de una obra. La
// API key de Claude vive SOLO como secret de Supabase — nunca llega al
// navegador.
//
// Multi-empresa: usa el JWT de quien llama (no la service-role key) — no lee
// ninguna tabla, solo reenvía la imagen a Claude, pero se mantiene el mismo
// patrón que ai-diagnostico por consistencia y porque valida que haya sesión.
//
// Deploy: supabase functions deploy leer-factura
// Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-... (ya configurado
// si ai-diagnostico funciona)

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

  const prompt = `Esta imagen es una factura o comprobante de gasto. Respondé ÚNICAMENTE con un JSON válido,
sin texto extra ni markdown, con esta forma exacta:
{"description": "proveedor y/o concepto breve", "amount": 1234.56, "currency": "ARS"}

Reglas:
- "description": texto corto (proveedor y concepto), en español.
- "amount": el monto total de la factura, como número (sin símbolos de moneda ni separadores de miles).
- "currency": el código de moneda de 3 letras si se puede inferir (ARS, USD, etc.), o null si no está claro.
Si no podés leer algún dato con confianza, usá null en ese campo puntual, pero siempre devolvé el JSON completo.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 300,
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
    return Response.json({ error: "la IA no pudo leer la factura", detail }, { status: 502, headers: CORS_HEADERS });
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";

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

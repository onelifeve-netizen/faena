// Edge Function de Supabase (Deno). Asistente de mantenimiento con IA: recibe
// una máquina y la descripción de una falla, lee el historial real de
// órdenes de trabajo de ese equipo, y le pide a Claude una causa probable +
// si conviene adelantar el próximo preventivo. La API key de Claude vive
// SOLO como secret de Supabase — nunca llega al navegador.
//
// Multi-empresa: usa el JWT de quien llama (no la service-role key), así las
// consultas quedan filtradas por RLS automáticamente — nadie puede pedir el
// diagnóstico de una máquina de otra empresa.
//
// Deploy: supabase functions deploy ai-diagnostico
// Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Secrets: supabase secrets set ANON_KEY=... (no se inyecta sola; Supabase no
// deja usar el prefijo SUPABASE_ en secrets personalizados)

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const { machine_id, failure_description } = await req.json();
  if (!machine_id || !failure_description) {
    return Response.json({ error: "faltan machine_id o failure_description" }, { status: 400, headers: CORS_HEADERS });
  }

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
  await supabase.from("ai_usage").insert({ function_name: "ai-diagnostico" });

  const [machineRes, ordersRes, scheduleRes] = await Promise.all([
    supabase.from("machines").select("*").eq("id", machine_id).maybeSingle(),
    supabase.from("work_orders").select("*").eq("machine_id", machine_id).order("created_at", { ascending: false }).limit(20),
    supabase.from("maintenance_schedules").select("*").eq("machine_id", machine_id),
  ]);

  const machine = machineRes.data;
  if (!machine) {
    return Response.json({ error: "equipo no encontrado" }, { status: 404, headers: CORS_HEADERS });
  }
  const history = (ordersRes.data ?? [])
    .map((o: any) => `- [${o.type}/${o.status}] ${o.created_at.slice(0, 10)}: ${o.title}${o.closed_note ? ` — resuelto: ${o.closed_note}` : ""}`)
    .join("\n") || "(sin órdenes de trabajo previas)";
  const schedules = (scheduleRes.data ?? [])
    .map((s: any) => `- ${s.name}: cada ${s.frequency_days} días, próximo ${s.next_due_at}`)
    .join("\n") || "(sin mantenimiento preventivo programado)";

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    return Response.json(
      { error: "falta el secret ANTHROPIC_API_KEY en Supabase" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const prompt = `Sos un asistente de mantenimiento industrial para una PyME latinoamericana.
Equipo: ${machine?.name ?? "desconocido"} (${machine?.category ?? "sin categoría"}).
Falla reportada ahora: "${failure_description}".

Historial de órdenes de trabajo de este equipo (más reciente primero):
${history}

Mantenimiento preventivo programado:
${schedules}

Con esta información, en español y en no más de 6 líneas: (1) sugerí la causa más probable de
la falla actual, basándote en patrones del historial si los hay, y (2) decí si conviene
adelantar el próximo mantenimiento preventivo o no, y por qué. Sé concreto, sin rodeos, pensado
para un técnico que tiene que decidir ahora.`;

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
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return Response.json({ error: "la IA no pudo responder", detail }, { status: 502, headers: CORS_HEADERS });
  }

  const data = await res.json();
  const suggestion = data.content?.[0]?.text ?? "Sin respuesta.";

  return Response.json({ suggestion }, { headers: CORS_HEADERS });
});

// Edge Function de Supabase (Deno). Resumen de salud de un equipo con IA: lee
// todo su historial (depreciación, órdenes de trabajo, mantenimientos
// programados) y devuelve un resumen en lenguaje simple de cuánta vida útil
// le queda, qué mantenimiento ya se hizo, qué falta, y si conviene seguir
// invirtiendo en mantenimiento o evaluar un reemplazo (CAPEX).
//
// A diferencia de ai-diagnostico (que diagnostica UNA falla puntual), esto es
// un resumen general del estado del equipo, sin que el usuario describa nada.
//
// Multi-empresa: usa el JWT de quien llama (no la service-role key), así las
// consultas quedan filtradas por RLS automáticamente.
//
// Deploy: supabase functions deploy resumen-salud
// Secrets: ya usa los mismos ANTHROPIC_API_KEY y ANON_KEY que ai-diagnostico.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const { machine_id } = await req.json();
  if (!machine_id) {
    return Response.json({ error: "falta machine_id" }, { status: 400, headers: CORS_HEADERS });
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

  const [machineRes, depRes, ordersRes, scheduleRes] = await Promise.all([
    supabase.from("machines").select("*").eq("id", machine_id).maybeSingle(),
    supabase.from("machine_depreciation").select("*").eq("machine_id", machine_id).maybeSingle(),
    supabase.from("work_orders").select("*").eq("machine_id", machine_id).order("created_at", { ascending: false }).limit(30),
    supabase.from("maintenance_schedules").select("*").eq("machine_id", machine_id),
  ]);

  const machine = machineRes.data;
  if (!machine) {
    return Response.json({ error: "equipo no encontrado" }, { status: 404, headers: CORS_HEADERS });
  }

  const dep = depRes.data;
  const history = (ordersRes.data ?? [])
    .map((o: any) => `- [${o.type}/${o.status}] ${o.created_at.slice(0, 10)}: ${o.title}${o.cost ? ` (costo ${o.cost})` : ""}${o.closed_note ? ` — ${o.closed_note}` : ""}`)
    .join("\n") || "(sin órdenes de trabajo registradas)";
  const schedules = (scheduleRes.data ?? [])
    .map((s: any) => `- ${s.name}: cada ${s.frequency_days} días, próximo ${s.next_due_at}`)
    .join("\n") || "(sin mantenimiento preventivo programado)";

  const depreciationInfo = dep?.purchase_price != null
    ? `Comprado el ${dep.purchase_date}, vida útil estimada ${dep.useful_life_years} años (llevan transcurridos ${dep.years_elapsed?.toFixed?.(1) ?? dep.years_elapsed}).
Valor en libros hoy: ${dep.book_value ?? "sin calcular"}.
Gasto de mantenimiento acumulado: ${dep.maintenance_cost_total}.`
    : "Sin datos de compra/vida útil cargados para este equipo.";

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    return Response.json(
      { error: "falta el secret ANTHROPIC_API_KEY en Supabase" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const prompt = `Sos un asistente de gestión de activos para una PyME latinoamericana.
Equipo: ${machine.name} (${machine.category ?? "sin categoría"}).

${depreciationInfo}

Historial de órdenes de trabajo (más reciente primero):
${history}

Mantenimiento preventivo programado:
${schedules}

Con esta información, en español y en no más de 8 líneas, dame un resumen de salud del equipo cubriendo:
1) Cuánta vida útil le queda (en términos simples, no solo el número de años).
2) Qué mantenimiento ya se le hizo (patrones si los hay).
3) Qué falta para mantenerlo funcionando bien.
4) Una recomendación concreta: ¿conviene seguir invirtiendo en mantenimiento, o ya está cerca de justificar evaluar un reemplazo? Compará el gasto de mantenimiento acumulado contra el valor en libros si los datos lo permiten.
Sé concreto y directo, pensado para alguien que tiene que decidir presupuesto.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return Response.json({ error: "la IA no pudo responder", detail }, { status: 502, headers: CORS_HEADERS });
  }

  const data = await res.json();
  const summary = data.content?.[0]?.text ?? "Sin respuesta.";

  return Response.json({ summary }, { headers: CORS_HEADERS });
});

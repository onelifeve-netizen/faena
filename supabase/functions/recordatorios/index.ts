// Edge Function de Supabase (Deno). Reemplaza al cron de Vercel: revisa obras
// con plazo vencido o a menos de 3 días y manda un mail resumen con Resend.
// Se programa con pg_cron (ver supabase/migration_007_cron_pg.sql) para que
// corra sola todos los días, sin depender de Vercel ni de GitHub Actions.
//
// Multi-empresa: corre con la service-role key (bypassa RLS), así que recorre
// cada empresa a mano y manda un mail separado por cada una que tenga
// notification_email configurado en Ajustes.
//
// Deploy: supabase functions deploy recordatorios
// Secrets: supabase secrets set RESEND_API_KEY=... (SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY ya existen automáticamente en toda Edge Function).

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const resendKey = Deno.env.get("RESEND_API_KEY");

  const { data: companies } = await supabase.from("companies").select("id, name");
  if (!companies || companies.length === 0) {
    return Response.json({ skipped: "no hay empresas registradas" });
  }

  const today = new Date();
  const in3Days = new Date(today);
  in3Days.setDate(today.getDate() + 3);
  const todayStr = today.toISOString().slice(0, 10);
  const in3DaysStr = in3Days.toISOString().slice(0, 10);

  const results = [];

  for (const company of companies) {
    const { data: settingsRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "notification_email")
      .eq("company_id", company.id)
      .maybeSingle();
    const notificationEmail = settingsRow?.value;
    if (!notificationEmail) {
      results.push({ company: company.name, skipped: "sin mail de notificación configurado" });
      continue;
    }

    const { data: jobs } = await supabase
      .from("jobs")
      .select("name, end_date, status")
      .eq("company_id", company.id)
      .in("status", ["planificada", "en_curso"])
      .not("end_date", "is", null)
      .lte("end_date", in3DaysStr);

    if (!jobs || jobs.length === 0) {
      results.push({ company: company.name, sent: false, reason: "no hay obras con plazo próximo" });
      continue;
    }

    const overdue = jobs.filter((j) => j.end_date < todayStr);
    const upcoming = jobs.filter((j) => j.end_date >= todayStr);

    const html = `
      <h2>Recordatorio de plazos — Faena</h2>
      ${overdue.length > 0 ? `
        <h3 style="color:#A34A22">Vencidas</h3>
        <ul>${overdue.map((j) => `<li><b>${j.name}</b> — plazo era ${j.end_date}</li>`).join("")}</ul>
      ` : ""}
      ${upcoming.length > 0 ? `
        <h3>Vencen en los próximos 3 días</h3>
        <ul>${upcoming.map((j) => `<li><b>${j.name}</b> — plazo: ${j.end_date}</li>`).join("")}</ul>
      ` : ""}
    `;

    if (!resendKey) {
      results.push({ company: company.name, skipped: "falta el secret RESEND_API_KEY", wouldHaveSent: jobs.length });
      continue;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Faena <onboarding@resend.dev>",
        to: notificationEmail,
        subject: `Recordatorio de plazos (${jobs.length} obra${jobs.length > 1 ? "s" : ""})`,
        html,
      }),
    });

    results.push({ company: company.name, sent: res.ok, jobCount: jobs.length });
  }

  return Response.json({ results });
});

-- Programa el recordatorio diario por mail usando pg_cron + pg_net (ambos ya
-- vienen habilitados en cualquier proyecto Supabase, incluso en el plan free).
-- Reemplaza al cron de Vercel/vercel.json.
--
-- ANTES de correr esto:
-- 1. Deployá la función: supabase functions deploy recordatorios
-- 2. Cargá el secret:    supabase secrets set RESEND_API_KEY=tu-key-de-resend
-- 3. Reemplazá TU_PROYECTO y TU_ANON_KEY abajo por los tuyos
--    (Project Settings → API en el dashboard de Supabase).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'faena-recordatorios-diarios',
  '0 12 * * *', -- todos los días a las 12:00 UTC, igual que antes en Vercel
  $$
  select net.http_post(
    url := 'https://TU_PROYECTO.supabase.co/functions/v1/recordatorios',
    headers := jsonb_build_object('Authorization', 'Bearer TU_ANON_KEY', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- Para revisar que quedó programado: select * from cron.job;
-- Para desprogramarlo: select cron.unschedule('faena-recordatorios-diarios');

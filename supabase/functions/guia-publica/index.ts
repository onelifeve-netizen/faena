// Edge Function de Supabase (Deno). Resuelve una guía de traslado por su
// share_token, SIN requerir sesión — pensada para compartir el link con
// alguien que no tiene cuenta (transportista, cliente). Usa la
// service-role key (bypassa RLS) pero solo expone la fila que matchea el
// token exacto, que funciona como la "llave" de acceso al documento.
//
// Deploy: supabase functions deploy guia-publica
// Secrets: ninguno nuevo — usa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY,
// que Supabase inyecta solo en todas las funciones.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return Response.json({ error: "falta el token" }, { status: 400, headers: CORS_HEADERS });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: note, error } = await supabase
    .from("transfer_notes")
    .select("*, machine:machines(id, name, serial, category)")
    .eq("share_token", token)
    .maybeSingle();

  if (error || !note) {
    return Response.json({ error: "guía no encontrada" }, { status: 404, headers: CORS_HEADERS });
  }

  const { data: company } = await supabase.from("companies").select("name").eq("id", note.company_id).maybeSingle();

  let photo_url: string | null = null;
  if (note.machine?.id) {
    const { data: photo } = await supabase
      .from("machine_photos")
      .select("photo_url")
      .eq("machine_id", note.machine.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (photo?.photo_url) {
      const { data: signed } = await supabase.storage.from("inventario-fotos").createSignedUrl(photo.photo_url, 86400);
      photo_url = signed?.signedUrl ?? null;
    }
  }

  return Response.json(
    {
      company_name: company?.name ?? "",
      machine_name: note.machine?.name ?? "",
      machine_serial: note.machine?.serial ?? "",
      machine_category: note.machine?.category ?? "",
      photo_url,
      from_location: note.from_location,
      to_location: note.to_location,
      note: note.note,
      created_by_email: note.created_by_email,
      created_at: note.created_at,
    },
    { headers: CORS_HEADERS }
  );
});

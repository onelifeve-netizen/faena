import { supabase } from "./supabase";

export async function logAudit(entityType: string, entityId: string | null, action: string, detail?: string) {
  const { data: userData } = await supabase.auth.getUser();
  await supabase.from("audit_log").insert({
    entity_type: entityType,
    entity_id: entityId,
    action,
    detail: detail ?? null,
    user_email: userData.user?.email ?? "desconocido",
  });
}

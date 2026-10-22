interface SupabaseError {
  message?: string;
  code?: string;
}

/** Traduce errores de Supabase/Postgres a un mensaje entendible, en español. */
export function friendlyError(error: SupabaseError | null | undefined): string {
  if (!error) return "";
  const msg = error.message ?? "";

  if (error.code === "23505" || /duplicate key/i.test(msg)) return "Ya existe un registro con ese dato.";
  if (error.code === "23503") return "Ese registro depende de otro dato que ya no existe o fue borrado.";
  if (error.code === "23502") return "Falta completar un campo obligatorio.";
  if (/JWT|session|not authenticated|refresh_token/i.test(msg)) return "Tu sesión expiró. Volvé a iniciar sesión.";
  if (/row-level security|permission denied|RLS/i.test(msg)) return "No tenés permiso para hacer esto con tu rol actual.";
  if (/Failed to fetch|NetworkError|network|timeout/i.test(msg)) return "No se pudo conectar. Revisá tu conexión e intentá de nuevo.";
  if (msg) return msg;
  return "Ocurrió un error y no se guardó. Intentá de nuevo.";
}

/**
 * Ejecuta una mutación de Supabase y devuelve si salió bien. Si falla, llama a
 * onError con un mensaje ya traducido — así cada pantalla solo necesita un
 * `if (!(await runMutation(...))) return;` en vez de repetir el chequeo de
 * error (y el riesgo de olvidarlo) en cada formulario.
 */
export async function runMutation(
  fn: () => PromiseLike<{ error: SupabaseError | null }>,
  onError: (message: string) => void
): Promise<boolean> {
  const { error } = await fn();
  if (error) {
    onError(friendlyError(error));
    return false;
  }
  onError("");
  return true;
}

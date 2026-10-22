import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { UserRole } from "./types";

export interface MyRole {
  role: UserRole | null;
  approved: boolean;
  loading: boolean;
}

/** Trae el rol/aprobación del usuario logueado. Null mientras no hay sesión o no cargó todavía. */
export function useMyRole(): MyRole {
  const [state, setState] = useState<MyRole>({ role: null, approved: false, loading: true });

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (active) setState({ role: null, approved: false, loading: false });
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role, approved")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (active) {
        setState({ role: (data?.role as UserRole) ?? null, approved: data?.approved ?? false, loading: false });
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return state;
}

export function canWrite(role: UserRole | null) {
  return role === "admin" || role === "tecnico";
}

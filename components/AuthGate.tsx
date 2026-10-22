"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import AppShell from "@/components/AppShell";

const PUBLIC_PATHS = ["/login", "/registro"];

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [approved, setApproved] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkApproval(userId: string) {
      const { data } = await supabase.from("user_roles").select("approved").eq("user_id", userId).maybeSingle();
      setApproved(data?.approved ?? false);
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecked(true);
      if (!data.session && !PUBLIC_PATHS.includes(pathname)) router.push("/login");
      if (data.session) checkApproval(data.session.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession && !PUBLIC_PATHS.includes(pathname)) router.push("/login");
      if (newSession) checkApproval(newSession.user.id);
    });

    return () => listener.subscription.unsubscribe();
  }, [pathname, router]);

  if (PUBLIC_PATHS.includes(pathname)) return <>{children}</>;

  if (!checked || !session || (session && approved === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-steel">
        Cargando...
      </div>
    );
  }

  if (!approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="max-w-sm text-center">
          <p className="font-display font-bold text-xl text-ink mb-2">Cuenta en espera</p>
          <p className="text-sm text-steel mb-4">
            Tu cuenta ({session.user.email}) todavía no fue aprobada por un administrador de la
            empresa. Pedile a alguien con acceso que te apruebe desde Usuarios.
          </p>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push("/login"))}
            className="focus-ring text-xs text-accent font-mono hover:underline"
          >
            cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);
  return session;
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSession } from "./AuthGate";
import Avatar from "./Avatar";
import { Profile } from "@/lib/types";

export default function UserMenu() {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase.from("profiles").select("*").eq("id", session.user.id).single().then(({ data }) => setProfile(data));
  }, [session]);

  if (pathname === "/login" || pathname === "/registro" || !session) return null;

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const fullName = profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() : "";

  return (
    <div className="px-5 py-4 border-t border-white/10">
      <Link href="/perfil" className="focus-ring flex items-center gap-2.5 hover:opacity-80">
        <Avatar avatarUrl={profile?.avatar_url} name={fullName} email={session.user.email} size={30} />
        <div className="overflow-hidden">
          <p className="text-xs text-white truncate">{fullName || session.user.email}</p>
          <p className="text-[10px] text-white/40 font-mono truncate">{session.user.email}</p>
        </div>
      </Link>
      <button onClick={signOut} className="focus-ring text-[11px] text-white/60 hover:text-white mt-2 font-mono">
        cerrar sesión
      </button>
    </div>
  );
}

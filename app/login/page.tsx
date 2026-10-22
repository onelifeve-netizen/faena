"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Logo from "@/components/Logo";
import BenefitsPanel from "@/components/BenefitsPanel";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError("Email o contraseña incorrectos.");
    else router.push("/");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-base">
      <BenefitsPanel />

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <div className="flex justify-center mb-3"><Logo size={44} /></div>
            <p className="font-display font-bold text-2xl text-ink">Faena</p>
            <p className="text-xs text-steel font-mono mt-1">acceso del equipo</p>
          </div>

          <div className="bg-panel border border-line rounded-tag shadow-card p-6">
            <h2 className="font-display font-bold text-xl text-ink mb-5">Ingresar</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block text-xs text-steel">
                Email
                <input
                  type="email"
                  required
                  className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vos@empresa.com"
                />
              </label>
              <label className="block text-xs text-steel">
                Contraseña
                <input
                  type="password"
                  required
                  minLength={6}
                  className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </label>
              {error && <p className="text-xs text-warn">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="focus-ring w-full bg-accent text-white text-sm py-2.5 rounded-tag hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Un momento..." : "Ingresar"}
              </button>
            </form>
          </div>
          <p className="text-[11px] text-steel text-center mt-4 font-mono">
            ¿Primera vez? <Link href="/registro" className="text-accent hover:underline">Crear cuenta</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

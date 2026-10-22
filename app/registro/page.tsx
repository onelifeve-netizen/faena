"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Logo from "@/components/Logo";
import BenefitsPanel from "@/components/BenefitsPanel";
import PasswordStrength from "@/components/PasswordStrength";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Registro() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const emailValid = EMAIL_RE.test(email);
  const allFilled = firstName.trim() && lastName.trim() && emailValid && password.length >= 6;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allFilled) return;
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName } },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setDone(true);
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-base">
      <BenefitsPanel />

      <div className="flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center lg:hidden">
          <div className="flex justify-center mb-3"><Logo size={44} /></div>
          <p className="font-display font-bold text-2xl text-ink">Faena</p>
          <p className="text-xs text-steel font-mono mt-1">crear cuenta de trabajador</p>
        </div>

        <div className="bg-panel border border-line rounded-tag shadow-card p-6">
          <h2 className="font-display font-bold text-xl text-ink mb-5 hidden lg:block">Crear cuenta</h2>
          {done ? (
            <div className="text-sm text-center py-2 space-y-2">
              <p className="text-ok">Cuenta creada.</p>
              <p className="text-steel">
                Un administrador de la empresa tiene que aprobarte antes de que puedas entrar al
                panel. Avisale que te registraste con {email}.
              </p>
              <Link href="/login" className="focus-ring inline-block text-accent font-mono text-xs hover:underline mt-2">
                ir a iniciar sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-steel">
                  Nombre
                  <input
                    required
                    className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Juan"
                  />
                </label>
                <label className="block text-xs text-steel">
                  Apellido
                  <input
                    required
                    className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Pérez"
                  />
                </label>
              </div>
              <label className="block text-xs text-steel">
                Email
                <input
                  type="email"
                  required
                  className={`focus-ring mt-1 w-full border rounded-tag px-3 py-2 text-sm ${
                    emailTouched && email && !emailValid ? "border-warn" : "border-line"
                  }`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  placeholder="vos@empresa.com"
                />
                {emailTouched && email && !emailValid && (
                  <span className="block mt-1 text-[11px] text-warn">Ese email no parece válido.</span>
                )}
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
                <PasswordStrength password={password} />
              </label>
              {error && <p className="text-xs text-warn">{error}</p>}
              <button
                type="submit"
                disabled={loading || !allFilled}
                className="focus-ring w-full bg-accent text-white text-sm py-2.5 rounded-tag hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Un momento..." : "Crear cuenta"}
              </button>
              {!allFilled && (
                <p className="text-[11px] text-steel text-center">Completá todos los campos para continuar.</p>
              )}
            </form>
          )}
        </div>
        <p className="text-[11px] text-steel text-center mt-4 font-mono">
          ¿Ya tenés cuenta aprobada? <Link href="/login" className="text-accent hover:underline">Ingresar</Link>
        </p>
      </div>
      </div>
    </div>
  );
}

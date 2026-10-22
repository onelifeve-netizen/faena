"use client";

import { useState } from "react";
import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import Logo from "@/components/Logo";
import SidebarNav from "@/components/SidebarNav";
import { IconSettings } from "@/components/Icons";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      {/* Barra superior, solo en mobile */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-ink text-white sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Logo size={24} />
          <span className="font-display font-bold">Faena</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="focus-ring p-1.5 rounded-tag hover:bg-white/10"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
      </div>

      {/* Fondo oscuro al abrir el menú en mobile */}
      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`w-64 lg:w-56 shrink-0 bg-ink text-white flex flex-col fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-6 border-b border-white/10 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <Logo size={30} />
            <div>
              <p className="font-display font-bold text-lg leading-tight">Faena</p>
              <p className="text-[11px] text-white/50 font-mono">GMAO para PyMEs</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Cerrar menú" className="focus-ring lg:hidden p-1 text-white/60 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <SidebarNav onNavigate={() => setOpen(false)} />
        <div className="px-3 pb-2">
          <Link
            href="/ajustes"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-tag text-xs text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <IconSettings className="text-white/40" /> Ajustes
          </Link>
        </div>
        <UserMenu />
      </aside>

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl min-w-0">{children}</main>
    </div>
  );
}

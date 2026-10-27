"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconBox, IconWrench, IconBuilding, IconUsers } from "./Icons";

const ITEMS = [
  { href: "/", label: "Resumen", icon: IconHome },
  { href: "/inventario", label: "Inventario", icon: IconBox },
  { href: "/mantenimiento", label: "Mantenimiento", icon: IconWrench },
  { href: "/obras", label: "Obras", icon: IconBuilding },
  { href: "/contactos", label: "Contactos", icon: IconUsers },
  { href: "/usuarios", label: "Usuarios", icon: IconUsers },
];

export default function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5 text-sm overflow-y-auto">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-tag transition-colors ${
              active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className={active ? "text-gold" : "text-white/40"} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import { useState } from "react";
import { DEFAULT_ITEM_TYPES, ITEM_TYPE_GLOSSARY, itemTypeLabel } from "@/lib/itemTypes";

export default function ItemTypeGlossary({ customTypes = [] }: { customTypes?: string[] }) {
  const [open, setOpen] = useState(false);
  const extra = customTypes.filter((t) => !DEFAULT_ITEM_TYPES.includes(t));

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="focus-ring ml-1 w-4 h-4 inline-flex items-center justify-center rounded-full bg-steel/20 text-steel text-[10px] font-mono hover:bg-steel/30"
        aria-label="Ver glosario de tipos"
      >
        ?
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 left-0 mt-1 w-72 bg-white border border-line rounded-tag shadow-md p-3 space-y-2">
            {DEFAULT_ITEM_TYPES.map((t) => (
              <p key={t} className="text-xs">
                <span className="font-semibold text-ink">{itemTypeLabel(t)}:</span>{" "}
                <span className="text-steel">{ITEM_TYPE_GLOSSARY[t]}</span>
              </p>
            ))}
            {extra.length > 0 && (
              <div className="pt-1.5 border-t border-line">
                <p className="text-[10px] text-steel uppercase tracking-wide font-mono mb-1">Tipos agregados por vos</p>
                {extra.map((t) => (
                  <p key={t} className="text-xs text-ink">{itemTypeLabel(t)}</p>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </span>
  );
}

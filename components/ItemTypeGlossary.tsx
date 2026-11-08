"use client";

import { useState } from "react";
import { ITEM_TYPES, ITEM_TYPE_LABELS, ITEM_TYPE_GLOSSARY } from "@/lib/itemTypes";

export default function ItemTypeGlossary() {
  const [open, setOpen] = useState(false);

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
            {ITEM_TYPES.map((t) => (
              <p key={t} className="text-xs">
                <span className="font-semibold text-ink">{ITEM_TYPE_LABELS[t]}:</span>{" "}
                <span className="text-steel">{ITEM_TYPE_GLOSSARY[t]}</span>
              </p>
            ))}
          </div>
        </>
      )}
    </span>
  );
}

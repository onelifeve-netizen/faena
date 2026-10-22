"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Contact } from "@/lib/types";

export default function ContactPicker({
  onSelect,
  placeholder = "Buscar contacto por nombre...",
}: {
  onSelect: (contact: Contact) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function search(q: string) {
    setQuery(q);
    setOpen(true);
    if (q.trim().length < 1) {
      setResults([]);
      return;
    }
    const { data } = await supabase.from("contacts").select("*").ilike("name", `%${q}%`).limit(6);
    setResults(data ?? []);
  }

  function pick(c: Contact) {
    onSelect(c);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  async function createNew() {
    if (!query.trim()) return;
    const { data } = await supabase
      .from("contacts")
      .insert({ name: query, role: newRole, phone: newPhone, email: newEmail })
      .select()
      .single();
    if (data) pick(data as Contact);
    setCreating(false);
    setNewRole("");
    setNewPhone("");
    setNewEmail("");
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        className="focus-ring w-full border border-line rounded-tag px-3 py-2 text-sm"
        placeholder={placeholder}
        value={query}
        onChange={(e) => search(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      {open && query.trim().length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-line rounded-tag shadow-md overflow-hidden">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-base flex items-center justify-between"
            >
              <span>{c.name}</span>
              <span className="text-xs text-steel">{c.role}</span>
            </button>
          ))}

          {!creating ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full text-left px-3 py-2 text-sm text-accent hover:bg-base font-mono border-t border-line"
            >
              + agregar "{query}" como contacto nuevo
            </button>
          ) : (
            <div className="p-3 border-t border-line bg-base space-y-2">
              <input
                className="focus-ring w-full border border-line rounded-tag px-2 py-1.5 text-xs"
                placeholder="Rol (cliente, encargado, plomero...)"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              />
              <input
                className="focus-ring w-full border border-line rounded-tag px-2 py-1.5 text-xs"
                placeholder="Teléfono"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
              <input
                className="focus-ring w-full border border-line rounded-tag px-2 py-1.5 text-xs"
                placeholder="Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <button
                type="button"
                onClick={createNew}
                className="focus-ring w-full bg-ink text-white text-xs py-1.5 rounded-tag"
              >
                Guardar en contactos y usar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

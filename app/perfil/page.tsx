"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import { Profile } from "@/lib/types";
import FormError from "@/components/FormError";
import { runMutation } from "@/lib/errors";

export default function Perfil() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", userData.user.id).single();
    setProfile(data);
    setFirstName(data?.first_name ?? "");
    setLastName(data?.last_name ?? "");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!profile) return;
    setSaving(true);
    setError("");
    const ok = await runMutation(
      () => supabase.from("profiles").update({ first_name: firstName, last_name: lastName }).eq("id", profile.id),
      setError
    );
    setSaving(false);
    if (!ok) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setError("");
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${profile.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) {
      setUploading(false);
      setError("No se pudo subir la imagen. ¿Está creado el bucket 'avatars' (migration_008)?");
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const ok = await runMutation(
      () => supabase.from("profiles").update({ avatar_url: `${urlData.publicUrl}?t=${Date.now()}` }).eq("id", profile.id),
      setError
    );
    setUploading(false);
    if (!ok) return;
    load();
  }

  if (loading) return <p className="text-steel text-sm">Cargando...</p>;
  if (!profile) return <p className="text-steel text-sm">No se encontró el perfil.</p>;

  return (
    <div className="max-w-md">
      <header className="mb-8">
        <p className="font-mono text-xs text-steel uppercase tracking-wide">Tu cuenta</p>
        <h1 className="font-display font-bold text-3xl text-ink">Perfil</h1>
      </header>

      <section className="bg-panel border border-line rounded-tag shadow-card p-5">
        <div className="flex items-center gap-4 mb-5">
          <Avatar avatarUrl={profile.avatar_url} name={`${profile.first_name ?? ""} ${profile.last_name ?? ""}`} email={profile.email} size={64} />
          <div>
            <button
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="focus-ring text-xs text-accent font-mono hover:underline disabled:opacity-50"
            >
              {uploading ? "Subiendo..." : "Cambiar foto"}
            </button>
            <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
          </div>
        </div>
        <FormError message={error} />

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block text-xs text-steel">
            Nombre
            <input className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </label>
          <label className="block text-xs text-steel">
            Apellido
            <input className="focus-ring mt-1 w-full border border-line rounded-tag px-3 py-2 text-sm" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </label>
        </div>
        <p className="text-xs text-steel mb-4">{profile.email}</p>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="focus-ring bg-accent text-white text-sm px-4 py-2 rounded-tag hover:opacity-90 disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar"}
          </button>
          {saved && <span className="text-xs text-ok">Guardado ✓</span>}
        </div>
      </section>
    </div>
  );
}

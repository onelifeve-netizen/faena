const STYLES: Record<string, string> = {
  disponible: "bg-ok/10 text-ok",
  en_obra: "bg-info/10 text-info",
  mantenimiento: "bg-warn/10 text-warn",
  planificada: "bg-steel/10 text-steel",
  en_curso: "bg-info/10 text-info",
  terminada: "bg-ok/10 text-ok",
  pendiente: "bg-steel/10 text-steel",
  cerrada: "bg-ok/10 text-ok",
};

const LABELS: Record<string, string> = {
  disponible: "Disponible",
  en_obra: "En obra",
  mantenimiento: "Mantenimiento",
  planificada: "Planificada",
  en_curso: "En curso",
  terminada: "Terminada",
  pendiente: "Pendiente",
  cerrada: "Cerrada",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STYLES[status] ?? "bg-steel/10 text-steel"}`}>
      {LABELS[status] ?? status}
    </span>
  );
}

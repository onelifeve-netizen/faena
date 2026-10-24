import { WorkOrder, MaintenanceSchedule } from "@/lib/types";

/** Línea de tiempo simple (SVG) con eventos reales: compra, mantenimientos hechos, hoy, próximo preventivo y fin de vida útil estimado. */
export default function MachineTimeline({
  purchaseDate,
  usefulLifeYears,
  orders,
  schedules,
}: {
  purchaseDate: string;
  usefulLifeYears: number | null;
  orders: WorkOrder[];
  schedules: MaintenanceSchedule[];
}) {
  const width = 640;
  const height = 70;
  const padLeft = 10;
  const padRight = 10;
  const axisY = 36;

  const start = new Date(purchaseDate).getTime();
  const today = Date.now();
  const end = usefulLifeYears
    ? start + usefulLifeYears * 365.25 * 24 * 3600 * 1000
    : Math.max(today, start) + 365.25 * 24 * 3600 * 1000;

  const nextSchedule = schedules
    .filter((s) => new Date(s.next_due_at).getTime() >= today)
    .sort((a, b) => a.next_due_at.localeCompare(b.next_due_at))[0];

  const span = Math.max(1, end - start);
  const x = (t: number) => padLeft + (Math.min(Math.max(t, start), end) - start) / span * (width - padLeft - padRight);

  const orderPoints = orders
    .filter((o) => o.created_at)
    .map((o) => ({
      t: new Date(o.created_at).getTime(),
      color: o.type === "preventivo" ? "#0E9F6E" : o.type === "emergencia" ? "#A34A22" : "#D97706",
      title: `${o.title} (${o.type}) — ${new Date(o.created_at).toLocaleDateString("es-AR")}`,
    }));

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <line x1={padLeft} y1={axisY} x2={width - padRight} y2={axisY} stroke="#E5E7F2" strokeWidth={2} />

      {/* compra */}
      <circle cx={x(start)} cy={axisY} r={5} fill="#6D28D9" />
      <text x={x(start)} y={axisY + 18} fontSize="9" fill="#5B6178" textAnchor="start">compra</text>

      {/* órdenes de trabajo */}
      {orderPoints.map((p, i) => (
        <circle key={i} cx={x(p.t)} cy={axisY} r={3.5} fill={p.color}>
          <title>{p.title}</title>
        </circle>
      ))}

      {/* hoy */}
      <circle cx={x(today)} cy={axisY} r={5} fill="#F4C430" stroke="#12172B" strokeWidth={1} />
      <text x={x(today)} y={axisY - 10} fontSize="9" fill="#12172B" textAnchor="middle">hoy</text>

      {/* próximo preventivo */}
      {nextSchedule && (
        <circle cx={x(new Date(nextSchedule.next_due_at).getTime())} cy={axisY} r={4} fill="#2563EB">
          <title>{`${nextSchedule.name} — ${nextSchedule.next_due_at}`}</title>
        </circle>
      )}

      {/* fin de vida útil */}
      <circle cx={x(end)} cy={axisY} r={5} fill="#5B6178" />
      <text x={x(end)} y={axisY + 18} fontSize="9" fill="#5B6178" textAnchor="end">
        {usefulLifeYears ? "fin de vida útil" : "estimado"}
      </text>
    </svg>
  );
}

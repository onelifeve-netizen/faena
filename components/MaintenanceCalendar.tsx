import { MaintenanceSchedule } from "@/lib/types";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

export default function MaintenanceCalendar({ schedules }: { schedules: MaintenanceSchedule[] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Lunes = 0 ... Domingo = 6
  const startOffset = (firstDay.getDay() + 6) % 7;

  const byDay: Record<number, MaintenanceSchedule[]> = {};
  schedules.forEach((s) => {
    const d = new Date(s.next_due_at + "T00:00:00");
    if (d.getFullYear() === year && d.getMonth() === month) {
      byDay[d.getDate()] = [...(byDay[d.getDate()] ?? []), s];
    }
  });

  const todayDate = today.getDate();
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[10px] text-steel font-mono">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const items = byDay[day] ?? [];
          const isToday = day === todayDate;
          const overdue = items.some((s) => s.next_due_at < today.toISOString().slice(0, 10));
          return (
            <div
              key={day}
              className={`aspect-square rounded-tag flex flex-col items-center justify-center text-[11px] ${
                isToday ? "bg-ink text-white" : items.length > 0 ? "bg-warn/10" : "bg-base"
              }`}
              title={items.map((s) => `${s.name} (${s.machine?.name})`).join(", ")}
            >
              <span className={isToday ? "text-white" : "text-ink"}>{day}</span>
              {items.length > 0 && (
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${overdue ? "bg-warn" : "bg-info"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

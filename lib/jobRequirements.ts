import { Machine, JobRequirement } from "./types";

export function countAvailable(machines: Machine[], matchText: string): number {
  const q = matchText.trim().toLowerCase();
  if (!q) return 0;
  return machines.filter(
    (m) =>
      m.status === "disponible" &&
      ((m.category ?? "").toLowerCase().includes(q) || (m.item_type ?? "").toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
  ).length;
}

export function requirementStatus(req: JobRequirement, machines: Machine[]): { checkable: boolean; available: number; ok: boolean } {
  if (!req.match_text) return { checkable: false, available: 0, ok: true };
  const available = countAvailable(machines, req.match_text);
  return { checkable: true, available, ok: available >= req.quantity };
}

export function jobMissingCount(requirements: JobRequirement[], machines: Machine[]): number {
  return requirements.filter((r) => {
    const s = requirementStatus(r, machines);
    return s.checkable && !s.ok;
  }).length;
}

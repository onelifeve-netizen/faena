const PALETTE = ["#6D28D9", "#2563EB", "#0E9F6E", "#D97706", "#DB2777"];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % PALETTE.length;
  return PALETTE[Math.abs(hash)];
}

export default function Avatar({
  avatarUrl,
  name,
  email,
  size = 32,
}: {
  avatarUrl?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
}) {
  const label = name?.trim() || email || "?";
  const initials = name?.trim()
    ? name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")
    : (email?.[0]?.toUpperCase() ?? "?");

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={label}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-display font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: colorFor(label), fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

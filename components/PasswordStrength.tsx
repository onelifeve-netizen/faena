function scorePassword(password: string): 0 | 1 | 2 | 3 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 1) return 1;
  if (score <= 3) return 2;
  return 3;
}

const LABELS = ["", "Débil", "Media", "Fuerte"];
const COLORS = ["", "bg-warn", "bg-info", "bg-ok"];
const TEXT_COLORS = ["", "text-warn", "text-info", "text-ok"];

export default function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = scorePassword(password);
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= score ? COLORS[score] : "bg-line"}`} />
        ))}
      </div>
      <p className={`text-[11px] mt-1 ${TEXT_COLORS[score]}`}>
        Contraseña {LABELS[score].toLowerCase()}
        {score === 1 && " — probá agregar números, mayúsculas o símbolos"}
      </p>
    </div>
  );
}

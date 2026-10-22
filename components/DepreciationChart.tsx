/** Gráfico de línea simple (SVG) mostrando cómo baja el valor en libros a lo largo de la vida útil. */
export default function DepreciationChart({
  purchasePrice,
  usefulLifeYears,
  yearsElapsed,
}: {
  purchasePrice: number;
  usefulLifeYears: number;
  yearsElapsed: number;
}) {
  const width = 280;
  const height = 110;
  const pad = 10;

  const x = (year: number) => pad + (year / usefulLifeYears) * (width - pad * 2);
  const y = (value: number) => pad + (1 - value / purchasePrice) * (height - pad * 2 - 14);

  const todayYear = Math.min(usefulLifeYears, Math.max(0, yearsElapsed));
  const todayValue = Math.max(0, purchasePrice - (purchasePrice / usefulLifeYears) * todayYear);

  const linePath = `M ${x(0)} ${y(purchasePrice)} L ${x(usefulLifeYears)} ${y(0)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <line x1={pad} y1={height - 14} x2={width - pad} y2={height - 14} stroke="#E5E7F2" strokeWidth={1} />
      <path d={linePath} fill="none" stroke="#6D28D9" strokeWidth={2} />
      <circle cx={x(todayYear)} cy={y(todayValue)} r={4} fill="#F4C430" stroke="#12172B" strokeWidth={1} />
      <text x={pad} y={height - 2} fontSize="9" fill="#5B6178">compra</text>
      <text x={width - pad - 42} y={height - 2} fontSize="9" fill="#5B6178">fin de vida útil</text>
    </svg>
  );
}

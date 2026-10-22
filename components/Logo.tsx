/**
 * Isotipo de Faena: una "F" geométrica de tres barras (blanco, dorado,
 * púrpura) sobre un cuadrado navy redondeado. Formas planas simples,
 * sin detalle fino, para que se recorte bien a cualquier tamaño
 * (favicon, ícono de app, encabezado) y se reconozca incluso chico.
 */
export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Faena">
      <rect width="48" height="48" rx="13" fill="#12172B" />
      <rect x="14" y="10" width="6" height="28" rx="2" fill="#FFFFFF" />
      <rect x="14" y="10" width="21" height="6" rx="2" fill="#F4C430" />
      <rect x="14" y="22" width="15" height="6" rx="2" fill="#6D28D9" />
    </svg>
  );
}

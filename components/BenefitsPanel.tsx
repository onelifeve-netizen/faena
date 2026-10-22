import Logo from "./Logo";

export default function BenefitsPanel() {
  return (
    <div
      className="relative hidden lg:flex flex-col justify-center overflow-hidden px-12 py-16 text-white"
      style={{ background: "linear-gradient(135deg, #12172B 0%, #3B2170 100%)" }}
    >
      <div className="absolute -right-20 -top-24 w-80 h-80 rounded-full bg-gold/10" />
      <div className="absolute -left-10 -bottom-24 w-72 h-72 rounded-full bg-white/5" />

      <div className="relative max-w-md">
        <div className="flex items-center gap-2.5 mb-10">
          <Logo size={32} />
          <span className="font-display font-bold text-lg">Faena</span>
        </div>

        <h1 className="font-display font-bold text-3xl leading-tight mb-2">
          Menos planillas.<br />Más obra hecha.
        </h1>
        <p className="text-sm text-white/60">
          Inventario, mantenimiento, obras y plata del equipo, en un solo lugar.
        </p>
      </div>
    </div>
  );
}

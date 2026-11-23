"use client";

export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-white border border-line rounded-tag shadow-card p-5 w-full max-w-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-base text-ink">{title}</h2>
          <button onClick={onClose} className="focus-ring text-sm text-steel hover:text-ink font-mono">
            ✕ cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

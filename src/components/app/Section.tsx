export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 bg-gradient-to-r from-moss to-leaf bg-clip-text text-xs font-bold uppercase tracking-wider text-transparent">
      {children}
    </h2>
  );
}

export function Card({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-leaf/15 bg-gradient-to-br from-white/95 via-white to-lime/[0.06] px-4 py-3 shadow-[0_8px_30px_rgba(15,31,23,0.06)] ring-1 ring-white/80 backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

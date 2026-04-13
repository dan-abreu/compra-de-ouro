export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl p-4 shadow-glow">
      <h2 className="mb-3 font-heading text-lg font-semibold text-stone-800">{title}</h2>
      {children}
    </section>
  );
}

export function LabeledValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-300/70 bg-white/85 p-3">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-stone-900">{value}</p>
    </div>
  );
}

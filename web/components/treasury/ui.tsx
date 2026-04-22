import { Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export const inputClassName =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100";

export const actionButtonClassName =
  "inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-50";

export function HelpBalloon({ title, content }: { title: string; content: string }) {
  return (
    <span className="group relative inline-flex">
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-500"
        aria-label={`Ajuda: ${title}`}
        title={title}
      >
        <Info size={12} />
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-64 -translate-x-1/2 rounded-xl border border-stone-200 bg-white p-3 text-[11px] leading-relaxed text-stone-600 shadow-xl group-hover:block group-focus-within:block">
        <strong className="mb-1 block text-xs text-stone-800">{title}</strong>
        {content}
      </span>
    </span>
  );
}

export function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  helpText,
  action
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  helpText?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
          <Icon size={16} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-widest text-stone-700">{title}</h2>
            {helpText ? <HelpBalloon title={title} content={helpText} /> : null}
          </div>
          {subtitle ? <p className="mt-0.5 text-xs text-stone-400">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  trend,
  helpText
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  helpText?: string;
}) {
  const trendClass = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-stone-400";

  return (
    <div className="glass rounded-2xl p-4 shadow-glow">
      <div className="mb-0.5 flex items-center gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">{label}</p>
        {helpText ? <HelpBalloon title={label} content={helpText} /> : null}
      </div>
      <p className="font-heading text-2xl font-bold leading-none tracking-tight text-stone-900">{value}</p>
      {sub ? (
        <div className={`mt-1 flex items-center gap-1 text-xs font-semibold ${trendClass}`}>
          <span>{sub}</span>
        </div>
      ) : null}
    </div>
  );
}

export function Chip({ label, variant }: { label: string; variant: "green" | "red" | "amber" | "sky" | "violet" }) {
  const cls = {
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-800",
    sky: "bg-sky-100 text-sky-800",
    violet: "bg-violet-100 text-violet-800"
  }[variant];

  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>;
}

export function GridHeader({ cols }: { cols: string[] }) {
  return (
    <tr className="border-b border-stone-200 text-left">
      {cols.map((col) => (
        <th key={col} className="pr-4 pb-2 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
          {col}
        </th>
      ))}
    </tr>
  );
}

export function ActionModal({
  open,
  title,
  subtitle,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 px-4 py-6">
      <div className="w-full max-w-lg rounded-3xl border border-stone-200 bg-stone-50 p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-heading text-xl font-bold text-stone-900">{title}</h3>
            <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className={actionButtonClassName}>
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
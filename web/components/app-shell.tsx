"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/compra", label: "Compra POS" },
  { href: "/venda", label: "Venda B2B" },
  { href: "/extrato", label: "Extrato" },
  { href: "/clientes", label: "Clientes" },
  { href: "/fornecedores", label: "Fornecedores" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8">
      <header className="glass mb-6 rounded-2xl p-4 shadow-glow animate-rise">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-heading text-xs uppercase tracking-[0.2em] text-brand-clay">Suriname Internal Treasury</p>
            <h1 className="font-heading text-2xl font-bold text-brand-ink">Casa de Ouro ERP</h1>
          </div>
          <span className="rounded-xl bg-brand-sun/70 px-3 py-1 text-xs font-semibold text-stone-900">
            Decimal-only ledger
          </span>
        </div>
        <nav className="grid grid-cols-2 gap-2 md:grid-cols-6">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-3 py-2 text-center text-sm font-semibold ${
                  active
                    ? "bg-stone-900 text-amber-100"
                    : "bg-white/75 text-stone-700 hover:bg-stone-200"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="animate-rise">{children}</main>
    </div>
  );
}

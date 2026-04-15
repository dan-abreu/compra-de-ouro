"use client";

import * as React from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { ApiError, apiRequest } from "@/lib/apiClient";
import { setAuthSession } from "@/lib/auth-store";

type LoginResponse = {
  accessToken: string;
  tenantId: string;
  user: {
    id: string;
    fullName: string;
    role: "ADMIN" | "OPERATOR";
  };
};

const getTenantFromHost = () => {
  if (typeof window === "undefined") {
    return "";
  }

  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length >= 3 && parts[0] !== "www" && host !== "localhost") {
    return parts[0];
  }

  return "";
};

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tenantId, setTenantId] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    setTenantId((current) => current || getTenantFromHost());
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const normalizedTenant = tenantId.trim();
    const normalizedUsername = username.trim().toLowerCase();

    if (!normalizedTenant || !normalizedUsername || !password) {
      setError("Preencha Código da Empresa, Usuário e Senha.");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        tenantId: normalizedTenant,
        username: normalizedUsername,
        email: normalizedUsername,
        password
      };

      const data = await apiRequest<LoginResponse>("/auth/login", "POST", payload, {
        tenantId: normalizedTenant,
        withAuth: false
      });

      setAuthSession({
        token: data.accessToken,
        tenantId: data.tenantId,
        tenantName: normalizedTenant,
        userId: data.user.id,
        userName: data.user.fullName,
        role: data.user.role,
        expiresAt: null
      });

      const next = searchParams.get("next") || "/dashboard";
      router.replace(next);
    } catch (rawError) {
      if (rawError instanceof ApiError) {
        setError(rawError.message || "Falha no login.");
      } else {
        setError("Nao foi possivel autenticar. Tente novamente.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(245,184,66,0.22),_transparent_32%),linear-gradient(180deg,_#020617_0%,_#0b1220_100%)] p-6">
      <section className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-950/70 p-8 text-slate-100 shadow-[0_40px_120px_rgba(15,23,42,0.55)] backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.24em] text-amber-300">SaaS Multi-Tenant</p>
        <h1 className="mt-2 text-3xl font-semibold">Acesso ao Caixa</h1>
        <p className="mt-2 text-sm text-slate-300">Informe a loja e suas credenciais para carregar o contexto correto do tenant.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm">
            <span className="mb-1.5 block text-slate-300">Codigo da Empresa</span>
            <input
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              placeholder="ex: loja-centro"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 outline-none transition focus:border-amber-300"
              autoComplete="organization"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block text-slate-300">Usuario</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="operador@loja.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 outline-none transition focus:border-amber-300"
              autoComplete="username"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block text-slate-300">Senha</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 outline-none transition focus:border-amber-300"
              autoComplete="current-password"
            />
          </label>

          {error ? <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

          <button
            disabled={isSubmitting}
            type="submit"
            className="w-full rounded-xl bg-amber-300 px-4 py-2.5 font-semibold text-slate-900 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}

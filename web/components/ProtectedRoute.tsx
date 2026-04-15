"use client";

import * as React from "react";

import { usePathname, useRouter } from "next/navigation";

import { clearAuthSession, useAuthStore } from "@/lib/auth-store";

type ProtectedRouteProps = {
  children: React.ReactNode;
  requiredRole?: "ADMIN" | "OPERATOR";
};

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuthStore();

  const isDeniedByRole = Boolean(requiredRole && auth.role && auth.role !== requiredRole);

  React.useEffect(() => {
    if (!auth.hydrated) {
      return;
    }

    const missingSession = !auth.token || !auth.tenantId || !auth.isAuthenticated;
    if (missingSession) {
      clearAuthSession();
      const next = encodeURIComponent(pathname || "/dashboard");
      router.replace(`/login?next=${next}`);
    }
  }, [auth.hydrated, auth.isAuthenticated, auth.tenantId, auth.token, pathname, router]);

  if (!auth.hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        Validando sessao...
      </div>
    );
  }

  if (!auth.token || !auth.tenantId || !auth.isAuthenticated) {
    return null;
  }

  if (isDeniedByRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="w-full max-w-md rounded-2xl border border-rose-400/35 bg-rose-500/10 p-6">
          <h2 className="text-xl font-semibold text-rose-200">Acesso negado</h2>
          <p className="mt-2 text-sm text-rose-100/90">Esta area exige perfil {requiredRole}. Seu perfil atual: {auth.role}.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

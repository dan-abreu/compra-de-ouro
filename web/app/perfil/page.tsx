"use client";

import { FormEvent, useEffect, useState } from "react";

import { Card } from "@/components/ui";
import { ApiError, apiRequest } from "@/lib/apiClient";
import { useAuthStore } from "@/lib/auth-store";

type MeResponse = {
  id: string;
  fullName: string;
  email: string;
  role: "ADMIN" | "OPERATOR";
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
};

export default function PerfilPage() {
  const auth = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    currentPassword: ""
  });
  const [meta, setMeta] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const me = await apiRequest<MeResponse>("/auth/me", "GET");
        setMeta(me);
        setForm({
          fullName: me.fullName,
          email: me.email,
          currentPassword: ""
        });
      } catch (loadError) {
        if (loadError instanceof ApiError) {
          setError(loadError.message);
        } else {
          setError("Nao foi possivel carregar o perfil.");
        }
      } finally {
        setLoading(false);
      }
    };

    load().catch(() => setError("Nao foi possivel carregar o perfil."));
  }, []);

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updated = await apiRequest<MeResponse>("/auth/profile", "POST", {
        fullName: form.fullName,
        email: form.email,
        currentPassword: form.currentPassword
      });

      setMeta(updated);
      setForm((prev) => ({ ...prev, currentPassword: "" }));
      setSuccess("Perfil atualizado com sucesso.");

      if (auth.token && auth.tenantId && auth.tenantName) {
        auth.setAuthSession({
          token: auth.token,
          tenantId: auth.tenantId,
          tenantName: auth.tenantName,
          userId: auth.userId ?? updated.id,
          userName: updated.fullName,
          role: updated.role,
          expiresAt: auth.expiresAt
        });
      }
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setError(submitError.message);
      } else {
        setError("Nao foi possivel atualizar o perfil.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Perfil do Operador">
        {loading ? <p className="text-sm text-slate-500">Carregando perfil...</p> : null}

        {error ? (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
        ) : null}

        {success ? (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {success}
          </div>
        ) : null}

        <form className="space-y-3" onSubmit={submitProfile}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Nome completo</label>
              <input
                value={form.fullName}
                onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                placeholder="Seu nome"
                disabled={loading || saving}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="voce@empresa.com"
                disabled={loading || saving}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Senha atual (confirmacao)</label>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
              placeholder="Digite sua senha atual"
              disabled={loading || saving}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || saving}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar perfil"}
            </button>
          </div>
        </form>
      </Card>

      <Card title="Resumo da Conta">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
            <p className="text-xs text-slate-500">ID</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-800">{meta?.id ?? "-"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
            <p className="text-xs text-slate-500">Perfil</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{meta?.role ?? "-"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
            <p className="text-xs text-slate-500">Status</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{meta?.status ?? "-"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
            <p className="text-xs text-slate-500">Criado em</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              {meta?.createdAt ? new Date(meta.createdAt).toLocaleDateString("pt-BR") : "-"}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

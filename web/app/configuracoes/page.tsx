"use client";

import { FormEvent, useEffect, useState } from "react";

import { Card } from "@/components/ui";
import { ApiError, apiRequest } from "@/lib/apiClient";
import { useAuthStore } from "@/lib/auth-store";

type LocalSettings = {
  requireCancelReason: boolean;
  autoRefreshExtratoSeconds: number;
  compactTables: boolean;
};

const SETTINGS_KEY = "compra_de_ouro.user.settings";

const defaultSettings: LocalSettings = {
  requireCancelReason: false,
  autoRefreshExtratoSeconds: 30,
  compactTables: false
};

export default function ConfiguracoesPage() {
  const auth = useAuthStore();

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [settings, setSettings] = useState<LocalSettings>(defaultSettings);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  const [cancelSecurityForm, setCancelSecurityForm] = useState({
    adminPassword: "",
    cancelSecurityPassword: "",
    confirmCancelSecurityPassword: ""
  });
  const [cancelSecuritySaving, setCancelSecuritySaving] = useState(false);
  const [cancelSecurityError, setCancelSecurityError] = useState<string | null>(null);
  const [cancelSecuritySuccess, setCancelSecuritySuccess] = useState<string | null>(null);
  const [cancelSecurityStatus, setCancelSecurityStatus] = useState<{
    configured: boolean;
    updatedAt: string | null;
    updatedByName: string | null;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<LocalSettings>;
      setSettings({
        requireCancelReason: Boolean(parsed.requireCancelReason),
        autoRefreshExtratoSeconds:
          typeof parsed.autoRefreshExtratoSeconds === "number" ? parsed.autoRefreshExtratoSeconds : 30,
        compactTables: Boolean(parsed.compactTables)
      });
    } catch {
      setSettings(defaultSettings);
    }
  }, []);

  useEffect(() => {
    const loadCancelSecurityStatus = async () => {
      try {
        const status = await apiRequest<{
          configured: boolean;
          updatedAt: string | null;
          updatedByName: string | null;
        }>("/auth/cancel-security-password/status", "GET");
        setCancelSecurityStatus(status);
      } catch {
        setCancelSecurityStatus(null);
      }
    };

    loadCancelSecurityStatus().catch(() => {
      setCancelSecurityStatus(null);
    });
  }, []);

  const saveSettings = () => {
    setSettingsSuccess(null);
    const safeSeconds = Math.max(5, Math.min(180, Number(settings.autoRefreshExtratoSeconds) || 30));
    const next = {
      ...settings,
      autoRefreshExtratoSeconds: safeSeconds
    };

    setSettings(next);
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    setSettingsSuccess("Configuracoes salvas no dispositivo atual.");
  };

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (passwordForm.newPassword.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Confirmacao de senha nao confere.");
      return;
    }

    try {
      setPasswordSaving(true);
      await apiRequest<{ ok: boolean }>("/auth/password", "POST", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      setPasswordSuccess("Senha alterada com sucesso.");
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setPasswordError(submitError.message);
      } else {
        setPasswordError("Nao foi possivel alterar a senha.");
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  const submitCancelSecurityPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCancelSecurityError(null);
    setCancelSecuritySuccess(null);

    if (cancelSecurityForm.cancelSecurityPassword.length < 6) {
      setCancelSecurityError("A senha de cancelamento deve ter pelo menos 6 caracteres.");
      return;
    }

    if (cancelSecurityForm.cancelSecurityPassword !== cancelSecurityForm.confirmCancelSecurityPassword) {
      setCancelSecurityError("Confirmacao da senha de cancelamento nao confere.");
      return;
    }

    try {
      setCancelSecuritySaving(true);
      await apiRequest<{ ok: boolean }>("/auth/cancel-security-password", "POST", {
        adminPassword: cancelSecurityForm.adminPassword,
        cancelSecurityPassword: cancelSecurityForm.cancelSecurityPassword,
        confirmCancelSecurityPassword: cancelSecurityForm.confirmCancelSecurityPassword
      });

      setCancelSecurityForm({
        adminPassword: "",
        cancelSecurityPassword: "",
        confirmCancelSecurityPassword: ""
      });
      setCancelSecuritySuccess("Senha de cancelamento definida com sucesso.");

      const status = await apiRequest<{
        configured: boolean;
        updatedAt: string | null;
        updatedByName: string | null;
      }>("/auth/cancel-security-password/status", "GET");
      setCancelSecurityStatus(status);
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setCancelSecurityError(submitError.message);
      } else {
        setCancelSecurityError("Nao foi possivel definir a senha de cancelamento.");
      }
    } finally {
      setCancelSecuritySaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Senha de Cancelamento de Ordens">
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Esta senha e criada exclusivamente por administrador. Qualquer operador que souber essa senha consegue cancelar ordens no extrato.
        </div>

        <div className="mb-3 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-700">
          <p>
            Status: <strong>{cancelSecurityStatus?.configured ? "Configurada" : "Nao configurada"}</strong>
          </p>
          <p>
            Ultima atualizacao: {cancelSecurityStatus?.updatedAt ? new Date(cancelSecurityStatus.updatedAt).toLocaleString("pt-BR") : "-"}
          </p>
          <p>Definida por: {cancelSecurityStatus?.updatedByName ?? "-"}</p>
        </div>

        {auth.role !== "ADMIN" ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            Somente admin pode criar/alterar essa senha.
          </div>
        ) : (
          <>
            {cancelSecurityError ? (
              <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {cancelSecurityError}
              </div>
            ) : null}

            {cancelSecuritySuccess ? (
              <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {cancelSecuritySuccess}
              </div>
            ) : null}

            <form className="space-y-3" onSubmit={submitCancelSecurityPassword}>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Senha atual do admin</label>
                <input
                  type="password"
                  value={cancelSecurityForm.adminPassword}
                  onChange={(event) =>
                    setCancelSecurityForm((prev) => ({ ...prev, adminPassword: event.target.value }))
                  }
                  disabled={cancelSecuritySaving}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Nova senha de cancelamento</label>
                  <input
                    type="password"
                    value={cancelSecurityForm.cancelSecurityPassword}
                    onChange={(event) =>
                      setCancelSecurityForm((prev) => ({ ...prev, cancelSecurityPassword: event.target.value }))
                    }
                    disabled={cancelSecuritySaving}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Confirmar senha de cancelamento</label>
                  <input
                    type="password"
                    value={cancelSecurityForm.confirmCancelSecurityPassword}
                    onChange={(event) =>
                      setCancelSecurityForm((prev) => ({ ...prev, confirmCancelSecurityPassword: event.target.value }))
                    }
                    disabled={cancelSecuritySaving}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={cancelSecuritySaving}
                  className="rounded-xl bg-gradient-to-r from-amber-700 to-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {cancelSecuritySaving ? "Salvando..." : "Definir senha de cancelamento"}
                </button>
              </div>
            </form>
          </>
        )}
      </Card>

      <Card title="Seguranca">
        <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Use esta secao para trocar sua senha pessoal de login.
        </div>

        {passwordError ? (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {passwordError}
          </div>
        ) : null}

        {passwordSuccess ? (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {passwordSuccess}
          </div>
        ) : null}

        <form className="space-y-3" onSubmit={submitPassword}>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Senha atual</label>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
              }
              disabled={passwordSaving}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Nova senha</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                disabled={passwordSaving}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Confirmar nova senha</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                }
                disabled={passwordSaving}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordSaving}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-60"
            >
              {passwordSaving ? "Alterando..." : "Alterar senha"}
            </button>
          </div>
        </form>
      </Card>

      <Card title="Preferencias Operacionais">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-700">
            Exigir motivo no cancelamento
            <input
              type="checkbox"
              checked={settings.requireCancelReason}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, requireCancelReason: event.target.checked }))
              }
            />
          </label>

          <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-700">
            Tabelas compactas
            <input
              type="checkbox"
              checked={settings.compactTables}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, compactTables: event.target.checked }))
              }
            />
          </label>
        </div>

        <div className="mt-3 max-w-xs">
          <label className="mb-1 block text-sm font-semibold text-slate-700">Auto refresh do extrato (segundos)</label>
          <input
            type="number"
            min={5}
            max={180}
            value={settings.autoRefreshExtratoSeconds}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                autoRefreshExtratoSeconds: Number(event.target.value)
              }))
            }
          />
        </div>

        {settingsSuccess ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {settingsSuccess}
          </div>
        ) : null}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={saveSettings}
            className="rounded-xl bg-gradient-to-r from-sky-700 to-cyan-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Salvar configuracoes
          </button>
        </div>
      </Card>
    </div>
  );
}

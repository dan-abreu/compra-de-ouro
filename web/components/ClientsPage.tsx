"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui";
import { ApiError, apiRequest } from "@/lib/api";

type Client = {
  id: string;
  fullName: string;
  documentId?: string | null;
  phone?: string | null;
  address?: string | null;
  goldOrigin?: string | null;
  kycDocumentUrl?: string | null;
  status: "ACTIVE" | "INACTIVE";
};

type ClientForm = {
  fullName: string;
  documentId: string;
  phone: string;
  address: string;
  goldOrigin: string;
  kycDocumentUrl: string;
};

const initialForm: ClientForm = {
  fullName: "",
  documentId: "",
  phone: "",
  address: "",
  goldOrigin: "",
  kycDocumentUrl: ""
};

export function ClientsPage() {
  const [message, setMessage] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<ClientForm>(initialForm);

  const fieldError = (field: keyof ClientForm) => fieldErrors[field];

  const loadClients = async () => {
    const data = await apiRequest<Client[]>("/clients", "GET");
    setClients(data);
  };

  useEffect(() => {
    loadClients()
      .catch(() => setGlobalError("Falha ao carregar clientes."))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setGlobalError("");
    setFieldErrors({});

    try {
      setSaving(true);
      await apiRequest("/clients", "POST", form);
      setMessage("Cliente cadastrado com sucesso.");
      setForm(initialForm);
      await loadClients();
    } catch (error) {
      if (error instanceof ApiError) {
        setGlobalError(error.message);
        setFieldErrors(error.fieldErrors);
      } else {
        setGlobalError("Falha ao cadastrar cliente.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Cadastro de Clientes (Vendedores de Ouro / Garimpeiros)">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
        {globalError ? <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 md:col-span-2">{globalError}</div> : null}
        {message ? <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 md:col-span-2">{message}</div> : null}

        <label>
          Nome completo
          <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
          {fieldError("fullName") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("fullName")}</p> : null}
        </label>

        <label>
          Numero do documento (ID/Passaporte) <span className="text-stone-500">Opcional</span>
          <input value={form.documentId} onChange={(e) => setForm({ ...form, documentId: e.target.value })} />
          {fieldError("documentId") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("documentId")}</p> : null}
        </label>

        <label>
          Telefone <span className="text-stone-500">Opcional</span>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {fieldError("phone") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("phone")}</p> : null}
        </label>

        <label>
          Endereco <span className="text-stone-500">Opcional</span>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          {fieldError("address") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("address")}</p> : null}
        </label>

        <label className="md:col-span-2">
          Origem do ouro <span className="text-stone-500">Opcional</span>
          <input value={form.goldOrigin} onChange={(e) => setForm({ ...form, goldOrigin: e.target.value })} />
          {fieldError("goldOrigin") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("goldOrigin")}</p> : null}
        </label>

        <label className="md:col-span-2">
          URL do documento (KYC) <span className="text-stone-500">Opcional</span>
          <input value={form.kycDocumentUrl} onChange={(e) => setForm({ ...form, kycDocumentUrl: e.target.value })} placeholder="https://..." />
          {fieldError("kycDocumentUrl") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("kycDocumentUrl")}</p> : null}
        </label>

        <div className="md:col-span-2 flex items-center justify-end">
          <button disabled={saving} className={`rounded-xl px-4 py-2 text-sm font-semibold ${saving ? "cursor-not-allowed bg-stone-300 text-stone-600" : "bg-stone-900 text-amber-100 hover:bg-stone-700"}`}>
            {saving ? "Salvando..." : "Salvar cliente"}
          </button>
        </div>
      </form>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-stone-300 text-left text-xs uppercase tracking-wide text-stone-600">
              <th className="px-2 py-2">Nome</th>
              <th className="px-2 py-2">Documento</th>
              <th className="px-2 py-2">Telefone</th>
              <th className="px-2 py-2">Origem</th>
              <th className="px-2 py-2">KYC</th>
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((item) => (
              <tr key={item.id} className="border-b border-stone-200/70">
                <td className="px-2 py-2">{item.fullName}</td>
                <td className="px-2 py-2">{item.documentId || "-"}</td>
                <td className="px-2 py-2">{item.phone || "-"}</td>
                <td className="px-2 py-2">{item.goldOrigin || "-"}</td>
                <td className="px-2 py-2">{item.kycDocumentUrl ? "Completo" : "Pendente"}</td>
                <td className="px-2 py-2">{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading ? <p className="mt-3 text-sm font-medium text-stone-700">Carregando clientes...</p> : null}
    </Card>
  );
}
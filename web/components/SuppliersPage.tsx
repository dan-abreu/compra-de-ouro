"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui";
import { ApiError, apiRequest } from "@/lib/api";

type Supplier = {
  id: string;
  companyName: string;
  documentId?: string | null;
  contactName?: string | null;
  phone?: string | null;
  address?: string | null;
  status: "ACTIVE" | "INACTIVE";
};

type SupplierForm = {
  companyName: string;
  documentId: string;
  contactName: string;
  phone: string;
  address: string;
};

const initialForm: SupplierForm = {
  companyName: "",
  documentId: "",
  contactName: "",
  phone: "",
  address: ""
};

export function SuppliersPage() {
  const [message, setMessage] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState<SupplierForm>(initialForm);

  const fieldError = (field: keyof SupplierForm) => fieldErrors[field];

  const loadSuppliers = async () => {
    const data = await apiRequest<Supplier[]>("/suppliers", "GET");
    setSuppliers(data);
  };

  useEffect(() => {
    loadSuppliers()
      .catch(() => setGlobalError("Falha ao carregar fornecedores."))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setGlobalError("");
    setFieldErrors({});

    try {
      setSaving(true);
      await apiRequest("/suppliers", "POST", form);
      setMessage("Fornecedor cadastrado com sucesso.");
      setForm(initialForm);
      await loadSuppliers();
    } catch (error) {
      if (error instanceof ApiError) {
        setGlobalError(error.message);
        setFieldErrors(error.fieldErrors);
      } else {
        setGlobalError("Falha ao cadastrar fornecedor.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Cadastro de Fornecedores (Compradores B2B / Ourives)">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
        {globalError ? <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 md:col-span-2">{globalError}</div> : null}
        {message ? <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 md:col-span-2">{message}</div> : null}

        <label>
          Nome da empresa/comprador
          <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
          {fieldError("companyName") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("companyName")}</p> : null}
        </label>

        <label>
          Numero de registro/ID <span className="text-stone-500">Opcional</span>
          <input value={form.documentId} onChange={(e) => setForm({ ...form, documentId: e.target.value })} />
          {fieldError("documentId") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("documentId")}</p> : null}
        </label>

        <label>
          Telefone do contato <span className="text-stone-500">Opcional</span>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {fieldError("phone") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("phone")}</p> : null}
        </label>

        <label>
          Nome do contato <span className="text-stone-500">Opcional</span>
          <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          {fieldError("contactName") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("contactName")}</p> : null}
        </label>

        <label className="md:col-span-2">
          Endereco <span className="text-stone-500">Opcional</span>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          {fieldError("address") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("address")}</p> : null}
        </label>

        <div className="md:col-span-2 flex items-center justify-end">
          <button disabled={saving} className={`rounded-xl px-4 py-2 text-sm font-semibold ${saving ? "cursor-not-allowed bg-stone-300 text-stone-600" : "bg-stone-900 text-amber-100 hover:bg-stone-700"}`}>
            {saving ? "Salvando..." : "Salvar fornecedor"}
          </button>
        </div>
      </form>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-stone-300 text-left text-xs uppercase tracking-wide text-stone-600">
              <th className="px-2 py-2">Empresa</th>
              <th className="px-2 py-2">Documento</th>
              <th className="px-2 py-2">Contato</th>
              <th className="px-2 py-2">Telefone</th>
              <th className="px-2 py-2">Endereco</th>
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((item) => (
              <tr key={item.id} className="border-b border-stone-200/70">
                <td className="px-2 py-2">{item.companyName}</td>
                <td className="px-2 py-2">{item.documentId || "-"}</td>
                <td className="px-2 py-2">{item.contactName || "-"}</td>
                <td className="px-2 py-2">{item.phone || "-"}</td>
                <td className="px-2 py-2">{item.address || "-"}</td>
                <td className="px-2 py-2">{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading ? <p className="mt-3 text-sm font-medium text-stone-700">Carregando fornecedores...</p> : null}
    </Card>
  );
}
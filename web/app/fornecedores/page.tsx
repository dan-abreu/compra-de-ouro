"use client";

import { useEffect } from "react";
import { useState } from "react";

import { Card } from "@/components/ui";
import { apiRequest } from "@/lib/api";

type SupplierForm = {
  companyName: string;
  documentId: string;
  contactName: string;
  phone: string;
  address: string;
};

export default function FornecedoresPage() {
  const [message, setMessage] = useState("");
  const [suppliers, setSuppliers] = useState<SupplierForm[]>([]);
  const [form, setForm] = useState<SupplierForm>({
    companyName: "",
    documentId: "",
    contactName: "",
    phone: "",
    address: ""
  });

  const loadSuppliers = async () => {
    const data = await apiRequest<SupplierForm[]>("/suppliers", "GET");
    setSuppliers(data);
  };

  useEffect(() => {
    loadSuppliers().catch(() => setMessage("Falha ao carregar fornecedores."));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      await apiRequest("/suppliers", "POST", form);
      setMessage("Fornecedor cadastrado com sucesso.");
      setForm({ companyName: "", documentId: "", contactName: "", phone: "", address: "" });
      await loadSuppliers();
    } catch {
      setMessage("Falha ao cadastrar fornecedor.");
    }
  };

  return (
    <Card title="Cadastro de Fornecedores (Compradores B2B)">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <label>
          Empresa/Comprador
          <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
        </label>

        <label>
          Documento/Registro
          <input value={form.documentId} onChange={(e) => setForm({ ...form, documentId: e.target.value })} required />
        </label>

        <label>
          Contato principal
          <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
        </label>

        <label>
          Telefone
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>

        <label className="md:col-span-2">
          Endereco
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </label>

        <button className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-stone-700 md:col-span-2">
          Salvar fornecedor
        </button>
      </form>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-stone-300 text-left text-xs uppercase tracking-wide text-stone-600">
              <th className="px-2 py-2">Empresa</th>
              <th className="px-2 py-2">Documento</th>
              <th className="px-2 py-2">Contato</th>
              <th className="px-2 py-2">Telefone</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((item) => (
              <tr key={`${item.documentId}-${item.companyName}`} className="border-b border-stone-200/70">
                <td className="px-2 py-2">{item.companyName}</td>
                <td className="px-2 py-2">{item.documentId}</td>
                <td className="px-2 py-2">{item.contactName || "-"}</td>
                <td className="px-2 py-2">{item.phone || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message ? <p className="mt-3 text-sm font-medium text-stone-700">{message}</p> : null}
    </Card>
  );
}

"use client";

import { useEffect } from "react";
import { useState } from "react";

import { Card } from "@/components/ui";
import { apiRequest } from "@/lib/api";

type ClientForm = {
  fullName: string;
  documentId: string;
  phone: string;
  address: string;
  goldOrigin: string;
  kycDocument: File | null;
};

export default function ClientesPage() {
  const [message, setMessage] = useState("");
  const [clients, setClients] = useState<ClientForm[]>([]);
  const [form, setForm] = useState<ClientForm>({
    fullName: "",
    documentId: "",
    phone: "",
    address: "",
    goldOrigin: "",
    kycDocument: null
  });

  const loadClients = async () => {
    const data = await apiRequest<ClientForm[]>("/clients", "GET");
    setClients(data);
  };

  useEffect(() => {
    loadClients().catch(() => setMessage("Falha ao carregar clientes."));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      await apiRequest("/clients", "POST", {
        fullName: form.fullName,
        documentId: form.documentId,
        phone: form.phone,
        address: form.address,
        goldOrigin: form.goldOrigin,
        kycDocumentUrl: form.kycDocument ? `/kyc/${form.kycDocument.name}` : undefined
      });

      setMessage("Cliente cadastrado com sucesso.");
      setForm({
        fullName: "",
        documentId: "",
        phone: "",
        address: "",
        goldOrigin: "",
        kycDocument: null
      });
      await loadClients();
    } catch {
      setMessage("Falha ao cadastrar cliente.");
    }
  };

  return (
    <Card title="Cadastro de Clientes (Vendedores/Garimpeiros)">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <label>
          Nome completo
          <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
        </label>

        <label>
          Documento/ID
          <input value={form.documentId} onChange={(e) => setForm({ ...form, documentId: e.target.value })} required />
        </label>

        <label>
          Telefone
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>

        <label>
          Endereco
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </label>

        <label className="md:col-span-2">
          Origem do ouro
          <input value={form.goldOrigin} onChange={(e) => setForm({ ...form, goldOrigin: e.target.value })} />
        </label>

        <label className="md:col-span-2">
          Foto do documento (KYC)
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setForm({ ...form, kycDocument: e.target.files?.[0] ?? null })}
          />
        </label>

        <button className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-stone-700 md:col-span-2">
          Salvar cliente
        </button>
      </form>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-stone-300 text-left text-xs uppercase tracking-wide text-stone-600">
              <th className="px-2 py-2">Nome</th>
              <th className="px-2 py-2">Documento</th>
              <th className="px-2 py-2">Telefone</th>
              <th className="px-2 py-2">Origem</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((item) => (
              <tr key={`${item.documentId}-${item.fullName}`} className="border-b border-stone-200/70">
                <td className="px-2 py-2">{item.fullName}</td>
                <td className="px-2 py-2">{item.documentId}</td>
                <td className="px-2 py-2">{item.phone || "-"}</td>
                <td className="px-2 py-2">{item.goldOrigin || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message ? <p className="mt-3 text-sm font-medium text-stone-700">{message}</p> : null}
    </Card>
  );
}

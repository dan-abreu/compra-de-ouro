import type { Dispatch, SetStateAction } from "react";

import type { Currency, ExpenseFormState } from "../useTreasuryDashboardState";
import { ActionModal, actionButtonClassName, inputClassName } from "../ui";

type ExpenseModalProps = {
  open: boolean;
  form: ExpenseFormState;
  setForm: Dispatch<SetStateAction<ExpenseFormState>>;
  onClose: () => void;
  onSave: () => void;
};

export function ExpenseModal({ open, form, setForm, onClose, onSave }: ExpenseModalProps) {
  return (
    <ActionModal
      open={open}
      title="Lancar Nova Despesa"
      subtitle="Use este formulario para registrar salarios, aluguel, luz e outras saidas da loja."
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <label className="block text-sm font-medium text-stone-700">
          Descricao (Ex: Salario, Luz, Aluguel)
          <input
            className={inputClassName}
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Ex: Salario do caixa"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-stone-700">
            Valor
            <input
              className={inputClassName}
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              placeholder="0.00"
            />
          </label>

          <label className="block text-sm font-medium text-stone-700">
            Moeda
            <select
              className={inputClassName}
              value={form.currency}
              onChange={(event) =>
                setForm((current) => ({ ...current, currency: event.target.value as Currency }))
              }
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="SRD">SRD</option>
            </select>
          </label>
        </div>

        <label className="block text-sm font-medium text-stone-700">
          Data
          <input
            className={inputClassName}
            type="date"
            value={form.occurredAt}
            onChange={(event) => setForm((current) => ({ ...current, occurredAt: event.target.value }))}
          />
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className={actionButtonClassName} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            Salvar
          </button>
        </div>
      </form>
    </ActionModal>
  );
}
